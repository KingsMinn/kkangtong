const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Item = sequelize.define('Item', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      comment: '항목 고유 ID'
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
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id'
      },
      comment: '카테고리 ID'
    },
    type: {
      type: DataTypes.ENUM('schedule', 'task', 'memo'),
      allowNull: false,
      comment: '항목 타입 (일정/할일/메모)'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '제목'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '내용/설명'
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: '태그 배열'
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
      comment: '우선순위'
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'active',
      comment: '상태 (active, completed, cancelled 등)'
    },
    // 일정용 필드
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '시작 날짜/시간'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '종료 날짜/시간'
    },
    isAllDay: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '하루종일 여부'
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: '장소'
    },
    // 할일용 필드
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '마감일'
    },
    progress: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '진행률 (0-100)'
    },
    estimatedDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '예상 소요 시간 (분)'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '완료 날짜'
    },
    // 메모용 필드
    isPinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '고정 여부'
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '보관 여부'
    },
    reminderDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '리마인더 날짜'
    },
    // 공통 필드
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: '첨부파일 정보'
    },
    aiExtracted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'AI가 추출한 항목인지 여부'
    },
    extractionData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'AI 추출 관련 메타데이터'
    }
  }, {
    tableName: 'items',
    timestamps: true,
    indexes: [
      {
        fields: ['userId', 'type']
      },
      {
        fields: ['userId', 'type', 'status']
      },
      {
        fields: ['startDate']
      },
      {
        fields: ['dueDate']
      },
      {
        fields: ['tags'],
        using: 'gin' // PostgreSQL용, SQLite에서는 무시됨
      },
      {
        fields: ['title']
      },
      {
        fields: ['content']
      },
      {
        fields: ['isPinned']
      },
      {
        fields: ['isArchived']
      }
    ]
  });

  return Item;
};

