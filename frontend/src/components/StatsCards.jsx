import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { databaseAPI } from '../api';

const StatsCards = ({ dateRange }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await databaseAPI.getStats(params);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
    } finally {
      setLoading(false);
    }
  };

  if (!stats) return null;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="Total Earthquakes"
            value={stats.total_count}
            valueStyle={{ color: '#3f8600' }}
            prefix={<ArrowUpOutlined />}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="Average Magnitude"
            value={stats.avg_magnitude?.toFixed(2)}
            precision={2}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="Max Magnitude"
            value={stats.max_magnitude?.toFixed(2)}
            precision={2}
            valueStyle={{ color: '#cf1322' }}
            prefix={<ArrowUpOutlined />}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card loading={loading}>
          <Statistic
            title="Average Depth (km)"
            value={stats.avg_depth?.toFixed(2)}
            precision={2}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatsCards;
