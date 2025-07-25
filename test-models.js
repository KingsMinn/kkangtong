const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    console.log('🔍 사용 가능한 Gemini 모델 목록 확인 중...');
    
    const models = await genAI.listModels();
    
    console.log('\n✅ 사용 가능한 모델들:');
    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name}`);
      if (model.displayName) {
        console.log(`   - 표시명: ${model.displayName}`);
      }
      if (model.description) {
        console.log(`   - 설명: ${model.description}`);
      }
      console.log('');
    });
    
    // Flash 관련 모델 필터링
    console.log('\n🚀 Flash 관련 모델들:');
    const flashModels = models.filter(model => 
      model.name.toLowerCase().includes('flash') || 
      model.displayName?.toLowerCase().includes('flash')
    );
    
    flashModels.forEach(model => {
      console.log(`✨ ${model.name}`);
    });
    
  } catch (error) {
    console.error('❌ 모델 목록 조회 실패:', error);
  }
}

listModels(); 