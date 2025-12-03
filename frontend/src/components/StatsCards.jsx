import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Typography, Tooltip, Space, Tag } from 'antd';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { databaseAPI } from '../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const StatsCards = ({ dateRange, autoRefresh = false, refreshInterval = 60000 }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setIsUpdating(true);
    try {
      const params = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await databaseAPI.getStats(params);
      setStats(response.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch stats', error);
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchStats]);

  // Format relative time
  const getRelativeTime = (date) => {
    if (!date) return 'Never';
    return dayjs(date).fromNow();
  };

  if (!stats) return null;

  return (
    <div>
      {/* Last Update Indicator */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginBottom: 8,
        alignItems: 'center'
      }}>
        <Space size="small">
          {isUpdating ? (
            <Tag icon={<SyncOutlined spin />} color="processing">
              Updating...
            </Tag>
          ) : (
            <Tooltip title={lastUpdate ? dayjs(lastUpdate).format('YYYY-MM-DD HH:mm:ss') : 'Never'}>
              <Tag icon={<CheckCircleOutlined />} color="success">
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                Updated {getRelativeTime(lastUpdate)}
              </Tag>
            </Tooltip>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="Total Earthquakes"
              value={stats.total_count}
              valueStyle={{ color: '#3f8600' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="Average Magnitude"
              value={stats.avg_magnitude?.toFixed(2)}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} hoverable>
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
          <Card loading={loading} hoverable>
            <Statistic
              title="Average Depth (km)"
              value={stats.avg_depth?.toFixed(2)}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StatsCards;
