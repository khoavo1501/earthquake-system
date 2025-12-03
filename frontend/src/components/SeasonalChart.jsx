import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { analysisAPI } from '../api';
import { message, Spin } from 'antd';

const SeasonalChart = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await analysisAPI.getSeasonal(params);
      const chartData = response.data.data.map(item => ({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        observed: item.observed || 0,
        trend: item.trend !== null && item.trend !== undefined ? item.trend : undefined,
        seasonal: item.seasonal !== null && item.seasonal !== undefined ? item.seasonal : undefined,
        residual: item.residual !== null && item.residual !== undefined ? item.residual : undefined
      }));

      setData(chartData);
    } catch (error) {
      if (error.response?.status === 400) {
        message.warning('Need at least 12 months of data for seasonal analysis');
      } else {
        message.error('Failed to fetch seasonal data');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Spin /></div>;
  }

  if (data.length === 0) {
    return (
      <div className="flex justify-center items-center h-96 text-gray-500">
        Insufficient data for seasonal decomposition (need at least 12 months)
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Observed & Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }} syncMethod="value">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="observed" stroke="#8884d8" strokeWidth={2} name="Observed" dot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="trend" stroke="#82ca9d" strokeWidth={2} name="Trend" dot={{ r: 3 }} connectNulls />
            <Brush dataKey="date" height={30} stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Seasonal Component</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="seasonal" stroke="#ffc658" strokeWidth={2} name="Seasonal" dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Residual</h3>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="residual" stroke="#ff7300" strokeWidth={2} name="Residual" dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SeasonalChart;
