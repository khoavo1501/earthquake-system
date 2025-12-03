import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analysisAPI } from '../api';
import { message, Spin } from 'antd';

const HistogramChartSimple = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { bins: 20 };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await analysisAPI.getDistribution(params);
      const chartData = response.data.histogram.map(item => ({
        magnitude: item.bin_center.toFixed(1),
        count: item.count,
        range: `${item.bin_start.toFixed(1)}-${item.bin_end.toFixed(1)}`
      }));

      setData(chartData);
    } catch (error) {
      message.error('Failed to fetch distribution data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin /></div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-semibold">Magnitude Range: {data.range}</p>
          <p>Count: {data.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="magnitude" 
          label={{ value: 'Magnitude', position: 'insideBottom', offset: -5 }}
        />
        <YAxis label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="count" fill="#8884d8" name="Earthquake Count" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default HistogramChartSimple;
