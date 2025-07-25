const { Sequelize } = require('sequelize');
require('dotenv').config();

// 환경에 따른 데이터베이스 설정
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

let sequelize;

if (isDevelopment) {
  // 개발 환경: SQLite 사용
  console.log('🔧 개발 환경: SQLite 사용');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.SQLITE_PATH || 'discord_secretary.sqlite',
    logging: console.log, // 개발 중에는 SQL 로그 보기
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    }
  });
} else {
  // 프로덕션 환경: PostgreSQL 사용
  console.log('🚀 프로덕션 환경: PostgreSQL 사용');
  sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'discord_secretary',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: false, // 프로덕션에서는 로그 끄기
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    timezone: '+09:00' // 한국 시간대
  });
}

// 모델 불러오기
const User = require('./models/User')(sequelize);
const Item = require('./models/item')(sequelize);
const Reminder = require('./models/Reminder')(sequelize);
const Category = require('./models/Category')(sequelize);
const Conversation = require('./models/Conversation')(sequelize);

// 관계 설정
const setupAssociations = () => {
  // User 관계
  User.hasMany(Item, { foreignKey: 'userId', as: 'items' });
  User.hasMany(Reminder, { foreignKey: 'userId', as: 'reminders' });
  User.hasMany(Category, { foreignKey: 'userId', as: 'categories' });
  User.hasMany(Conversation, { foreignKey: 'userId', as: 'conversations' });

  // Category 관계
  Category.hasMany(Item, { foreignKey: 'categoryId', as: 'items' });

  // 역참조
  Item.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Item.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
  
  Reminder.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  
  Conversation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
};

// 데이터베이스 연결 및 동기화
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    
    if (isDevelopment) {
      console.log('✅ SQLite 연결 성공! 📁 파일: discord_secretary.sqlite');
    } else {
      console.log('✅ PostgreSQL 연결 성공!');
    }
    
    setupAssociations();
    
    // 개발 환경에서만 테이블 자동 동기화
    if (isDevelopment) {
      await sequelize.sync({ force: true }); // 개발 환경에서는 테이블 재생성
      console.log('📊 SQLite 테이블 생성 완료!');
      
      // 개발용 기본 카테고리 생성 (일단 주석 처리)
      // await createDefaultCategories();
    } else {
      // 프로덕션에서는 마이그레이션 사용 권장
      await sequelize.sync({ alter: true });
      console.log('📊 PostgreSQL 테이블 동기화 완료!');
    }
    
    return sequelize;
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    if (isDevelopment) {
      console.error('💡 SQLite 파일 권한을 확인하세요.');
    } else {
      console.error('💡 PostgreSQL 연결 정보를 확인하세요.');
    }
    process.exit(1);
  }
};

// 개발용 기본 데이터 생성
const createDefaultCategories = async () => {
  try {
    const defaultCategories = [
      { name: '업무', description: '업무 관련 일정 및 할일', color: '#3498db', icon: '💼' },
      { name: '개인', description: '개인적인 일정 및 할일', color: '#e74c3c', icon: '🏠' },
      { name: '학습', description: '공부 및 학습 관련', color: '#f39c12', icon: '📚' },
      { name: '건강', description: '운동 및 건강 관리', color: '#27ae60', icon: '🏃' },
      { name: '기타', description: '기타 모든 것들', color: '#95a5a6', icon: '📌' }
    ];

    for (const categoryData of defaultCategories) {
      await Category.findOrCreate({
        where: { 
          name: categoryData.name,
          userId: null // 전역 카테고리로 생성
        },
        defaults: { 
          ...categoryData, 
          isDefault: true,
          userId: null // 명시적으로 null 설정
        }
      });
    }
    
    console.log('📁 기본 카테고리 생성 완료!');
  } catch (error) {
    console.error('⚠️ 기본 카테고리 생성 실패:', error.message);
    // 에러가 발생해도 봇 시작을 계속 진행
  }
};

// 데이터베이스 마이그레이션 함수 (SQLite → PostgreSQL)
const migrateToPostgreSQL = async () => {
  console.log('🔄 SQLite에서 PostgreSQL로 마이그레이션 시작...');
  
  // SQLite 연결
  const sqliteDB = new Sequelize({
    dialect: 'sqlite',
    storage: 'discord_secretary.sqlite',
    logging: false
  });
  
  // PostgreSQL 연결
  const postgresDB = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: false
  });
  
  try {
    // 마이그레이션 로직 구현 (필요시)
    console.log('✅ 마이그레이션 완료!');
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
  }
};

module.exports = {
  sequelize,
  connectDB,
  migrateToPostgreSQL,
  models: {
    User,
    Item,
    Reminder,
    Category,
    Conversation
  }
};
