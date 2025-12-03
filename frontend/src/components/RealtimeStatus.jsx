import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Tooltip } from 'antd';
import { ClockCircleOutlined, GlobalOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(relativeTime);

const { Text } = Typography;

const RealtimeStatus = ({ lastDataUpdate }) => {
  const [currentTime, setCurrentTime] = useState(dayjs());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Card 
      size="small"
      style={{ 
        marginBottom: 16,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: 8
      }}
      bodyStyle={{ padding: '12px 20px' }}
    >
      <Space size="large" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        {/* World Time (UTC) */}
        <Space>
          <GlobalOutlined style={{ color: '#fff', fontSize: 18 }} />
          <div>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>
              🌍 World Time (UTC)
            </Text>
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              {currentTime.utc().format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </div>
        </Space>

        {/* Local Time */}
        <Space>
          <ClockCircleOutlined style={{ color: '#fff', fontSize: 18 }} />
          <div>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>
              🇻🇳 Local Time (GMT+7)
            </Text>
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              {currentTime.format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </div>
        </Space>

        {/* Last Data Update */}
        <Space>
          <ClockCircleOutlined style={{ color: '#fff', fontSize: 18 }} />
          <div>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>
              📊 Last Data Update
            </Text>
            <Tooltip title={lastDataUpdate ? dayjs(lastDataUpdate).format('YYYY-MM-DD HH:mm:ss') : 'Chưa cập nhật'}>
              <Text strong style={{ color: '#fff', fontSize: 16 }}>
                {lastDataUpdate ? dayjs(lastDataUpdate).format('YYYY-MM-DD HH:mm:ss') : 'Chưa cập nhật'}
              </Text>
            </Tooltip>
            {lastDataUpdate && (
              <Text style={{ color: '#52c41a', fontSize: 12, display: 'block', marginTop: 2 }}>
                <CheckCircleOutlined /> Updated {dayjs(lastDataUpdate).fromNow()}
              </Text>
            )}
          </div>
        </Space>
      </Space>
    </Card>
  );
};

export default RealtimeStatus;
