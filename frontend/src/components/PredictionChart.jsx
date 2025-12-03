import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, BarChart, Bar, Brush } from 'recharts';
import { predictionAPI } from '../api';
import { message, Spin, Select } from 'antd';

const { Option } = Select;

const PredictionChart = ({ type = 'count' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [model, setModel] = useState('prophet');

  useEffect(() => {
    fetchData();
  }, [type, days, model]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let response;
      const params = { days };

      switch (type) {
        case 'count':
          response = await predictionAPI.getForecast({ ...params, model });
          break;
        case 'risk':
          response = await predictionAPI.getRiskForecast(params);
          break;
        case 'magnitude':
          response = await predictionAPI.getMagnitudeForecast(params);
          break;
        default:
          response = await predictionAPI.getForecast(params);
      }

      setData(response.data);
    } catch (error) {
      message.error(`Failed to fetch ${type} prediction`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Spin /></div>;
  }

  if (!data) return null;

  const renderCountForecast = () => {
    const chartData = [
      ...data.historical_data.map(item => ({
        date: new Date(item.date).toLocaleDateString(),
        actual: item.count,
        type: 'Historical'
      })),
      ...data.forecast.map(item => ({
        date: new Date(item.date).toLocaleDateString(),
        predicted: item.predicted_count,
        lower: item.lower_bound,
        upper: item.upper_bound,
        type: 'Forecast'
      }))
    ];

    return (
      <div>
        <div className="mb-4 flex gap-4">
          <Select value={days} onChange={setDays} style={{ width: 150 }}>
            <Option value={7}>7 Days</Option>
            <Option value={14}>14 Days</Option>
            <Option value={30}>30 Days</Option>
          </Select>
          <Select value={model} onChange={setModel} style={{ width: 150 }}>
            <Option value="prophet">Prophet</Option>
            <Option value="arima">ARIMA</Option>
          </Select>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }} syncMethod="value">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="upper" 
              fill="#8884d8" 
              fillOpacity={0.2}
              stroke="none"
              name="Upper Bound"
            />
            <Area 
              type="monotone" 
              dataKey="lower" 
              fill="#8884d8" 
              fillOpacity={0.2}
              stroke="none"
              name="Lower Bound"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#82ca9d" 
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Historical Count"
            />
            <Line 
              type="monotone" 
              dataKey="predicted" 
              stroke="#ff7300" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4 }}
              name="Predicted Count"
            />
            <Brush dataKey="date" height={30} stroke="#8884d8" />
          </AreaChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-gray-600 text-sm">Average Historical</div>
            <div className="text-2xl font-bold">{data.summary?.avg_historical?.toFixed(1)}</div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-gray-600 text-sm">Average Forecast</div>
            <div className="text-2xl font-bold">{data.summary?.avg_forecast?.toFixed(1)}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <div className="text-gray-600 text-sm">Trend</div>
            <div className="text-2xl font-bold capitalize">{data.summary?.trend}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderRiskForecast = () => {
    const chartData = data.risk_forecast.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      risk_score: item.risk_score,
      predicted_count: item.predicted_count,
      risk_level: item.risk_level
    }));

    return (
      <div>
        <div className="mb-4">
          <Select value={days} onChange={setDays} style={{ width: 150 }}>
            <Option value={7}>7 Days</Option>
            <Option value={14}>14 Days</Option>
            <Option value={30}>30 Days</Option>
          </Select>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }} syncMethod="value">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="risk_score" fill="#ff7300" name="Risk Score" />
            <Brush dataKey="date" height={30} stroke="#ff7300" />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded">
            <div className="text-gray-600 text-sm">High Risk Days</div>
            <div className="text-2xl font-bold">{data.summary?.high_risk_days}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded">
            <div className="text-gray-600 text-sm">Medium Risk Days</div>
            <div className="text-2xl font-bold">{data.summary?.medium_risk_days}</div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-gray-600 text-sm">Low Risk Days</div>
            <div className="text-2xl font-bold">{data.summary?.low_risk_days}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderMagnitudeForecast = () => {
    const chartData = data.magnitude_forecast.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      predicted_magnitude: item.predicted_magnitude,
      lower: item.lower_bound,
      upper: item.upper_bound
    }));

    return (
      <div>
        <div className="mb-4">
          <Select value={days} onChange={setDays} style={{ width: 150 }}>
            <Option value={7}>7 Days</Option>
            <Option value={14}>14 Days</Option>
            <Option value={30}>30 Days</Option>
          </Select>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }} syncMethod="value">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis domain={[0, 'auto']} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="upper" 
              stroke="#ff7300" 
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="Upper Bound"
            />
            <Line 
              type="monotone" 
              dataKey="predicted_magnitude" 
              stroke="#8884d8" 
              strokeWidth={3}
              dot={{ r: 5 }}
              name="Predicted Magnitude"
            />
            <Line 
              type="monotone" 
              dataKey="lower" 
              stroke="#82ca9d" 
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="Lower Bound"
            />
            <Brush dataKey="date" height={30} stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-gray-600 text-sm">Historical Avg Magnitude</div>
            <div className="text-2xl font-bold">{data.summary?.historical_avg_magnitude}</div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-gray-600 text-sm">Forecast Avg Magnitude</div>
            <div className="text-2xl font-bold">{data.summary?.forecast_avg_magnitude}</div>
          </div>
        </div>
      </div>
    );
  };

  switch (type) {
    case 'count':
      return renderCountForecast();
    case 'risk':
      return renderRiskForecast();
    case 'magnitude':
      return renderMagnitudeForecast();
    default:
      return renderCountForecast();
  }
};

export default PredictionChart;
