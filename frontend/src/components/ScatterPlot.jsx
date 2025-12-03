import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis, Brush } from 'recharts';
import { databaseAPI, clusteringAPI } from '../api';
import { message, Spin } from 'antd';

const ScatterPlot = ({ dateRange, type = 'normal', height = 400 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brushIndexes, setBrushIndexes] = useState({ startIndex: 0, endIndex: undefined });
  const chartRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetchData();
  }, [dateRange, type]);

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
    const newRange = Math.max(10, Math.min(data.length, Math.round(currentRange * zoomFactor)));
    
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
      if (type === 'clustering') {
        const response = await clusteringAPI.getMagnitudeClusters({
          start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
          end_date: dateRange?.[1]?.format('YYYY-MM-DD')
        });

        const scatterData = response.data.data_points.map(point => ({
          magnitude: point.magnitude,
          depth: point.depth,
          cluster: point.cluster,
          time: new Date(point.time).getTime()
        }));

        setData(scatterData);
      } else {
        const response = await databaseAPI.getEarthquakes({
          limit: 1000,
          start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
          end_date: dateRange?.[1]?.format('YYYY-MM-DD')
        });

        const scatterData = response.data.data.map(eq => ({
          time: new Date(eq.time).getTime(),
          magnitude: eq.magnitude,
          depth: eq.depth,
          id: eq.id
        }));

        setData(scatterData);
      }
    } catch (error) {
      message.error('Failed to fetch scatter plot data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center" style={{ height }}><Spin /></div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-semibold">Magnitude: {data.magnitude?.toFixed(2)}</p>
          <p>Depth: {data.depth?.toFixed(2)} km</p>
          {data.time && <p>Time: {new Date(data.time).toLocaleDateString()}</p>}
          {data.cluster !== undefined && <p>Cluster: {data.cluster}</p>}
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
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }} syncMethod="value">
          <CartesianGrid />
          <XAxis 
            type="number" 
            dataKey={type === 'clustering' ? 'magnitude' : 'time'} 
            name={type === 'clustering' ? 'Magnitude' : 'Time'}
            tickFormatter={type === 'clustering' ? (val) => val.toFixed(1) : (val) => new Date(val).toLocaleDateString()}
          />
          <YAxis 
            type="number" 
            dataKey={type === 'clustering' ? 'depth' : 'magnitude'} 
            name={type === 'clustering' ? 'Depth' : 'Magnitude'}
          />
          <ZAxis type="number" dataKey="depth" range={[50, 400]} name="Depth" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Scatter 
            name={type === 'clustering' ? 'Magnitude vs Depth' : 'Earthquake Events'} 
            data={data} 
            fill="#8884d8"
            shape="circle"
          />
          <Brush 
            dataKey={type === 'clustering' ? 'magnitude' : 'time'} 
            height={30} 
            stroke="#8884d8"
            startIndex={brushIndexes.startIndex}
            endIndex={brushIndexes.endIndex}
            onChange={(newIndexes) => setBrushIndexes(newIndexes)}
            travellerWidth={10}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScatterPlot;
