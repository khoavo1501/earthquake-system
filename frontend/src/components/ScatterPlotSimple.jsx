import React, { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from 'recharts';
import { databaseAPI, clusteringAPI } from '../api';
import { message, Spin } from 'antd';

const ScatterPlotSimple = ({ dateRange, type = 'normal', height = 400 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [dateRange, type]);

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
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default ScatterPlotSimple;
