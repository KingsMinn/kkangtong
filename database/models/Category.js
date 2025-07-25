const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true, // 전역 카테고리 허용을 위해 null 허용
      references: {
        model: 'users',
        key: 'id'
      },
      comment: '소유자 사용자 ID (null이면 전역 카테고리)'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '카테고리 이름'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '카테고리 설명'
    },
    color: {
      type: DataTypes.STRING(7), // #RRGGBB 형식
      defaultValue: '#3498db',
      comment: '카테고리 색상 (헥스 코드)'
    },
    icon: {
      type: DataTypes.STRING(10),
      defaultValue: '📁',
      comment: '카테고리 아이콘 (이모지)'
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '정렬 우선순위 (낮을수록 상위)'
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '기본 제공 카테고리 여부'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: '활성화 상태'
    }
  }, {
    tableName: 'categories',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['name']
      },
      {
        fields: ['isDefault']
      }
      // SQLite 호환성을 위해 복잡한 인덱스 제거
    ]
  });

  return Category;
}; 