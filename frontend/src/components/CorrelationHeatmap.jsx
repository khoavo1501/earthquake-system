import React, { useState, useEffect } from 'react';
import { analysisAPI } from '../api';
import { message, Spin } from 'antd';

const CorrelationHeatmap = ({ dateRange }) => {
  const [data, setData] = useState(null);
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

      const response = await analysisAPI.getCorrelation(params);
      setData(response.data);
    } catch (error) {
      message.error('Failed to fetch correlation data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Spin /></div>;
  }

  if (!data) return null;

  const getColor = (value) => {
    const intensity = Math.abs(value);
    if (value > 0) {
      return `rgba(34, 139, 34, ${intensity})`; // Green for positive
    } else {
      return `rgba(220, 20, 60, ${intensity})`; // Red for negative
    }
  };

  const variables = data.variables || [];
  const matrix = data.correlation_matrix || {};

  return (
    <div className="w-full overflow-auto">
      <div className="inline-block min-w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2 bg-gray-100"></th>
              {variables.map(variable => (
                <th key={variable} className="border border-gray-300 p-2 bg-gray-100 text-sm">
                  {variable}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variables.map(rowVar => (
              <tr key={rowVar}>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-sm">
                  {rowVar}
                </td>
                {variables.map(colVar => {
                  const value = matrix[rowVar]?.[colVar] || 0;
                  return (
                    <td
                      key={colVar}
                      className="border border-gray-300 p-3 text-center text-sm font-semibold"
                      style={{
                        backgroundColor: getColor(value),
                        color: Math.abs(value) > 0.5 ? 'white' : 'black'
                      }}
                      title={`${rowVar} vs ${colVar}: ${value.toFixed(3)}`}
                    >
                      {value.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex justify-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8" style={{ backgroundColor: 'rgba(220, 20, 60, 1)' }}></div>
          <span>Negative Correlation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8" style={{ backgroundColor: 'rgba(34, 139, 34, 1)' }}></div>
          <span>Positive Correlation</span>
        </div>
      </div>
    </div>
  );
};

export default CorrelationHeatmap;
