import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { analysisAPI } from '../api';
import { message, Spin } from 'antd';

const HistogramChart = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brushIndexes, setBrushIndexes] = useState({ startIndex: 0, endIndex: undefined });
  const chartRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  useEffect(() => {
    if (data.length > 0) {
      setBrushIndexes({ startIndex: 0, endIndex: data.length - 1 });
      setZoomLevel(1);
    }
  }, [data.length]);

  const handleWheel = (e) => {
    if (!data.length) return;
    
    // Prevent page scroll
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY;
    const zoomFactor = delta > 0 ? 0.95 : 1.05;
    
    const currentRange = brushIndexes.endIndex - brushIndexes.startIndex;
    const center = (brushIndexes.startIndex + brushIndexes.endIndex) / 2;
    const newRange = Math.max(5, Math.min(data.length, Math.round(currentRange * zoomFactor)));
    
    let newStart = Math.round(center - newRange / 2);
    let newEnd = Math.round(center + newRange / 2);
    
    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }
    if (newEnd >= data.length) {
      newEnd = data.length - 1;
      newStart = Math.max(0, newEnd - newRange);
    }
    
    setBrushIndexes({ startIndex: newStart, endIndex: newEnd });
    setZoomLevel(data.length / newRange);
  };

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
    <div 
      ref={chartRef}
      onWheel={handleWheel}
      style={{ 
        cursor: 'crosshair', 
        userSelect: 'none',
        overflow: 'hidden',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        document.body.style.overflow = 'hidden';
      }}
      onMouseLeave={(e) => {
        document.body.style.overflow = 'auto';
      }}
    >
      <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
        Zoom: {zoomLevel.toFixed(1)}x
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }} syncMethod="value">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="magnitude" 
            label={{ value: 'Magnitude', position: 'insideBottom', offset: -5 }}
          />
          <YAxis label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="count" fill="#8884d8" name="Earthquake Count" />
          <Brush 
            dataKey="magnitude" 
            height={30} 
            stroke="#8884d8"
            startIndex={brushIndexes.startIndex}
            endIndex={brushIndexes.endIndex}
            onChange={(newIndexes) => setBrushIndexes(newIndexes)}
            travellerWidth={10}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistogramChart;
