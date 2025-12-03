import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { analysisAPI } from '../api';
import { message, Spin } from 'antd';

const TimeSeriesChart = ({ dateRange, period = 'daily', showTrend = false }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brushIndexes, setBrushIndexes] = useState({ startIndex: 0, endIndex: undefined });
  const chartRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetchData();
  }, [dateRange, period]);

  useEffect(() => {
    // Reset brush when data changes
    if (data.length > 0) {
      setBrushIndexes({ startIndex: 0, endIndex: data.length - 1 });
      setZoomLevel(1);
    }
  }, [data.length]);

  // Handle mouse wheel zoom
  const handleWheel = (e) => {
    if (!data.length) return;
    
    // Prevent page scroll
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY;
    const zoomFactor = delta > 0 ? 0.95 : 1.05; // Smooth zoom factor
    
    const currentRange = brushIndexes.endIndex - brushIndexes.startIndex;
    const center = (brushIndexes.startIndex + brushIndexes.endIndex) / 2;
    const newRange = Math.max(10, Math.min(data.length, Math.round(currentRange * zoomFactor)));
    
    // Keep center fixed while zooming
    let newStart = Math.round(center - newRange / 2);
    let newEnd = Math.round(center + newRange / 2);
    
    // Boundary check
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
      const params = { period };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await analysisAPI.getTimeseries(params);
      const chartData = response.data.data.map((item, index) => ({
        date: new Date(item.date).toLocaleDateString(),
        count: item.count,
        avgMagnitude: item.avg_magnitude,
        trend: response.data.trend?.trend_line?.[index] || null
      }));

      setData(chartData);
    } catch (error) {
      message.error('Failed to fetch time series data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin /></div>;
  }

  return (
    <div 
      ref={chartRef}
      onWheel={handleWheel}
      style={{ 
        cursor: 'crosshair', 
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        margin: 0,
        padding: 0,
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
      <div style={{ marginBottom: 8, fontSize: 12, color: '#666', padding: '0 5px' }}>
        Zoom: {zoomLevel.toFixed(1)}x (Cuộn chuột để zoom)
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }} syncMethod="value">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            angle={-45}
            textAnchor="end"
            height={80}
            domain={[brushIndexes.startIndex, brushIndexes.endIndex]}
          />
          <YAxis yAxisId="left" label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Magnitude', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="count" 
            stroke="#8884d8" 
            strokeWidth={2}
            name="Earthquake Count"
            dot={{ r: 4 }}
            animationDuration={200}
            isAnimationActive={false}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="avgMagnitude" 
            stroke="#82ca9d" 
            strokeWidth={2}
            name="Avg Magnitude"
            dot={{ r: 4 }}
            animationDuration={200}
            isAnimationActive={false}
          />
          {showTrend && (
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="trend" 
              stroke="#ff7300" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Trend Line"
              dot={false}
              animationDuration={200}
              isAnimationActive={false}
            />
          )}
              dot={false}
            />
          )}
          <Brush 
            dataKey="date" 
            height={30} 
            stroke="#8884d8"
            startIndex={brushIndexes.startIndex}
            endIndex={brushIndexes.endIndex}
            onChange={(newIndexes) => setBrushIndexes(newIndexes)}
            travellerWidth={10}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TimeSeriesChart;
