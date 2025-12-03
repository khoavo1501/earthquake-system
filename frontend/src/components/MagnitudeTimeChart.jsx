import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { databaseAPI } from '../api';
import { message, Spin } from 'antd';

const MagnitudeTimeChart = ({ dateRange, height = 400 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await databaseAPI.getEarthquakes({
        limit: 1000,
        start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: dateRange?.[1]?.format('YYYY-MM-DD')
      });

      console.log('Raw data:', response.data.data.length);

      // Group by date and calculate average magnitude
      const groupedData = {};
      response.data.data.forEach(eq => {
        if (!eq.magnitude || isNaN(eq.magnitude)) return; // Skip invalid magnitudes
        
        const date = new Date(eq.time).toLocaleDateString();
        if (!groupedData[date]) {
          groupedData[date] = {
            date: date,
            magnitudes: [],
            maxMagnitude: -Infinity,
            minMagnitude: Infinity,
            count: 0
          };
        }
        groupedData[date].magnitudes.push(Number(eq.magnitude));
        groupedData[date].maxMagnitude = Math.max(groupedData[date].maxMagnitude, Number(eq.magnitude));
        groupedData[date].minMagnitude = Math.min(groupedData[date].minMagnitude, Number(eq.magnitude));
        groupedData[date].count += 1;
      });

      const chartData = Object.values(groupedData)
        .filter(item => item.magnitudes.length > 0)
        .map(item => {
          const sum = item.magnitudes.reduce((a, b) => a + b, 0);
          const avg = sum / item.magnitudes.length;
          
          // Convert date string back to Date object for proper sorting
          const dateParts = item.date.split('/');
          const dateObj = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
          
          return {
            date: item.date,
            timestamp: dateObj.getTime(),
            avgMagnitude: Number(avg.toFixed(2)),
            maxMagnitude: Number(item.maxMagnitude.toFixed(2)),
            minMagnitude: Number(item.minMagnitude.toFixed(2)),
            count: item.count
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log('Chart data sample:', chartData.slice(0, 3));
      console.log('Total data points:', chartData.length);
      setData(chartData);
    } catch (error) {
      message.error('Failed to fetch magnitude data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center" style={{ height }}><Spin /></div>;
  }

  if (data.length === 0) {
    return <div className="flex justify-center items-center" style={{ height }}>No data available</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-semibold">{data.date}</p>
          <p style={{ color: '#8884d8' }}>Avg Magnitude: {data.avgMagnitude}</p>
          <p style={{ color: '#82ca9d' }}>Max Magnitude: {data.maxMagnitude}</p>
          <p style={{ color: '#ffc658' }}>Min Magnitude: {data.minMagnitude}</p>
          <p>Earthquakes: {data.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          angle={-45}
          textAnchor="end"
          height={90}
          interval="preserveStartEnd"
          tick={{ fontSize: 11 }}
        />
        <YAxis 
          label={{ value: 'Magnitude', angle: -90, position: 'insideLeft' }}
          domain={[0, 'auto']}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="avgMagnitude" 
          stroke="#8884d8" 
          strokeWidth={2}
          dot={{ r: 4 }}
          name="Average Magnitude"
          connectNulls
        />
        <Line 
          type="monotone" 
          dataKey="maxMagnitude" 
          stroke="#82ca9d" 
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Max Magnitude"
          connectNulls
        />
        <Line 
          type="monotone" 
          dataKey="minMagnitude" 
          stroke="#ffc658" 
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Min Magnitude"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default MagnitudeTimeChart;
