const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: '대화 기록 고유 ID'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: '사용자 ID'
    },
    channelId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Discord 채널 ID'
    },
    messageId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Discord 메시지 ID'
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false,
      comment: '메시지 역할 (사용자 or 봇)'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '메시지 내용'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '메시지 시간'
    }
  }, {
    tableName: 'conversations',
    timestamps: true,
    indexes: [
      {
        fields: ['userId', 'channelId', 'timestamp']
      },
      {
        fields: ['userId', 'timestamp']
      }
    ]
  });

  return Conversation;
}; 