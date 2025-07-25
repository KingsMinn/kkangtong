const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Reminder = sequelize.define('Reminder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: '소유자 사용자 ID'
    },
    type: {
      type: DataTypes.ENUM('schedule', 'task', 'memo', 'custom'),
      allowNull: false,
      comment: '알림 타입'
    },
    referenceId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '참조 대상 ID (일정, 할일, 메모 등)'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '알림 제목'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '알림 메시지'
    },
    scheduledTime: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '예정된 알림 시간'
    },
    actualSentTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '실제 발송 시간'
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed', 'cancelled'),
      defaultValue: 'pending',
      comment: '알림 상태'
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
      comment: '알림 우선순위'
    },
    channels: {
      type: DataTypes.JSON, // SQLite 호환을 위해 JSONB → JSON
      defaultValue: ['discord'],
      comment: '알림 채널 (discord, email 등)'
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '반복 알림 여부'
    },
    recurringPattern: {
      type: DataTypes.JSON, // SQLite 호환을 위해 JSONB → JSON
      allowNull: true,
      comment: '반복 패턴 설정 (daily, weekly, monthly 등)'
    },
    nextOccurrence: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '다음 반복 알림 시간'
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '재시도 횟수'
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      comment: '최대 재시도 횟수'
    },
    metadata: {
      type: DataTypes.JSON, // SQLite 호환을 위해 JSONB → JSON
      defaultValue: {},
      comment: '추가 메타데이터'
    }
  }, {
    tableName: 'reminders',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['scheduledTime']
      },
      {
        fields: ['nextOccurrence']
      },
      {
        fields: ['type', 'referenceId']
      },
      {
        fields: ['userId', 'status', 'scheduledTime']
      }
    ]
  });

  return Reminder;
}; 