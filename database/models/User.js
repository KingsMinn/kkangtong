const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    discordId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Discord 사용자 ID'
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Discord 사용자명'
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Discord 표시 이름'
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Discord 아바타 URL'
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'Asia/Seoul',
      comment: '사용자 시간대'
    },
    settings: {
      type: DataTypes.JSON, // SQLite 호환을 위해 JSONB → JSON
      defaultValue: {
        notifications: true,
        proactiveReminders: true,
        reminderMinutes: [10, 60, 1440], // 10분, 1시간, 1일 전
        workingHours: {
          start: '09:00',
          end: '18:00'
        }
      },
      comment: '사용자 개인 설정'
    },
    lastActivity: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '마지막 활동 시간'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '계정 활성화 상태'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['discordId']
      },
      {
        fields: ['lastActivity']
      }
    ]
  });

  return User;
}; 