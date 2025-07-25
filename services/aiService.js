const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
require('dotenv').config();

class AIService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');
    }

    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.flashModelName = 'gemini-2.5-flash';
    this.proModelName = 'gemini-1.5-pro';
    this.proThreshold = parseFloat(process.env.USE_GEMINI_PRO_THRESHOLD) || 0.7;
    
    console.log('🤖 AI 서비스 초기화 완료 - REST API 방식, Flash 모델: gemini-2.5-flash');
  }

  /**
   * 복잡도를 분석하여 적절한 모델을 선택 (Flash 모델만 사용하도록 수정)
   */
  async selectModel(task, content) {
    // 항상 Flash 모델만 사용
    console.log(`🤖 작업: ${task}, 모델: Flash (항상)`);
    return this.flashModelName;
  }

  /**
   * 일정 정보를 자연어에서 파싱
   */
  async parseScheduleFromText(text) {
    const model = await this.selectModel('parse_schedule', text);
    
    const prompt = `
다음 텍스트에서 일정 정보를 추출해주세요. JSON 형식으로 반환하되, 추출할 수 없는 정보는 null로 설정하세요.

텍스트: "${text}"

반환 형식:
{
  "title": "일정 제목",
  "description": "상세 설명 (있으면)",
  "startDate": "YYYY-MM-DD HH:MM",
  "endDate": "YYYY-MM-DD HH:MM (있으면)",
  "location": "장소 (있으면)",
  "isAllDay": true/false,
  "priority": "low/normal/high/urgent",
  "confidence": 0.0-1.0
}

현재 날짜/시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
상대적 시간 표현(내일, 다음주 등)을 절대 시간으로 변환해주세요.
`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${this.flashModelName}:generateContent`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // JSON 부분만 추출
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: parsed,
          rawResponse: text
        };
      }
      
      throw new Error('JSON 형식을 찾을 수 없습니다');
    } catch (error) {
      console.error('일정 파싱 오류:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        rawResponse: null
      };
    }
  }

  /**
   * 할일 정보를 자연어에서 파싱
   */
  async parseTaskFromText(text) {
    const model = await this.selectModel('parse_task', text);
    
    const prompt = `
다음 텍스트에서 할일 정보를 추출해주세요. JSON 형식으로 반환하되, 추출할 수 없는 정보는 null로 설정하세요.

텍스트: "${text}"

반환 형식:
{
  "title": "할일 제목",
  "description": "상세 설명 (있으면)",
  "dueDate": "YYYY-MM-DD HH:MM (마감일이 있으면)",
  "priority": "low/normal/high/urgent",
  "estimatedDuration": 소요시간_분단위_숫자 (추정 가능하면),
  "tags": ["태그1", "태그2"] (있으면),
  "subtasks": ["하위작업1", "하위작업2"] (있으면),
  "confidence": 0.0-1.0
}

현재 날짜/시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${this.flashModelName}:generateContent`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: parsed,
          rawResponse: text
        };
      }
      
      throw new Error('JSON 형식을 찾을 수 없습니다');
    } catch (error) {
      console.error('할일 파싱 오류:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        rawResponse: null
      };
    }
  }

  /**
   * 이미지 분석 함수
   */
  async analyzeImage(imageUrl, prompt = "이 이미지에 대해 설명해주세요.") {
    try {
      const axios = require('axios');
      
      // 이미지 다운로드
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);
      
      // 이미지를 base64로 변환
      const base64Image = imageBuffer.toString('base64');
      
      // Gemini API 호출
      const result = await axios.post(
        `${this.baseUrl}/models/${this.flashModelName}:generateContent`,
        {
          contents: [{
            parts: [{
              text: `
다음 이미지를 분석해주세요.

이미지 URL: ${imageUrl}

이미지 데이터 (Base64):
${base64Image}

${prompt}
`
            }]
          }]
        },
        {
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      console.log(`🖼️ 이미지 분석 완료: ${text.slice(0, 100)}...`);
      
      return {
        success: true,
        response: text,
        metadata: {
          imageUrl,
          mimeType: response.headers['content-type'],
          size: imageBuffer.length
        }
      };
      
    } catch (error) {
      console.error('이미지 분석 오류:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        response: '이미지 분석 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 스마트 검색 - 의미적 검색을 위한 쿼리 확장
   */
  async enhanceSearchQuery(query, searchType = 'all') {
    const model = await this.selectModel('smart_search', query);
    
    const prompt = `
사용자 검색 쿼리를 분석하여 더 효과적인 검색을 위한 키워드들을 제안해주세요.

원본 쿼리: "${query}"
검색 대상: ${searchType} (all/schedule/task/memo)

다음 JSON 형식으로 반환해주세요:
{
  "originalQuery": "${query}",
  "expandedKeywords": ["키워드1", "키워드2", "키워드3"],
  "synonyms": ["동의어1", "동의어2"],
  "relatedTerms": ["관련용어1", "관련용어2"],
  "searchSuggestions": ["검색제안1", "검색제안2"],
  "intent": "검색 의도 (find_schedule/find_task/find_memo/general)",
  "confidence": 0.0-1.0
}
`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${this.flashModelName}:generateContent`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: parsed,
          rawResponse: text
        };
      }
      
      throw new Error('JSON 형식을 찾을 수 없습니다');
    } catch (error) {
      console.error('검색 쿼리 확장 오류:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        rawResponse: null
      };
    }
  }

  /**
   * 능동적 추천 - 사용자 데이터 기반 추천
   */
  async generateRecommendations(userData) {
    const model = await this.selectModel('recommendation', JSON.stringify(userData));
    
    const prompt = `
사용자의 일정, 할일, 메모 데이터를 분석하여 도움이 될 추천사항을 제안해주세요.

사용자 데이터:
${JSON.stringify(userData, null, 2)}

현재 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}

다음 JSON 형식으로 반환해주세요:
{
  "urgentTasks": [{"id": "할일ID", "reason": "긴급한 이유"}],
  "upcomingSchedules": [{"id": "일정ID", "timeUntil": "남은시간"}],
  "suggestions": [
    {
      "type": "reminder/optimization/planning",
      "title": "제안 제목",
      "description": "제안 설명",
      "priority": "low/normal/high",
      "actionable": true/false
    }
  ],
  "productivity": {
    "score": 0.0-1.0,
    "insights": ["인사이트1", "인사이트2"]
  },
  "confidence": 0.0-1.0
}
`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${this.flashModelName}:generateContent`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: parsed,
          rawResponse: text
        };
      }
      
      throw new Error('JSON 형식을 찾을 수 없습니다');
    } catch (error) {
      console.error('추천 생성 오류:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        rawResponse: null
      };
    }
  }

  /**
   * REST API로 직접 호출하는 응답 생성 함수
   */
  async generateResponse(prompt, useProModel = false) {
    const modelName = useProModel ? this.proModelName : this.flashModelName;
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${modelName}:generateContent`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        console.log(`✅ AI 응답 성공 (${modelName}): ${text.slice(0, 100)}...`);
        return {
          success: true,
          response: text,
          model: modelName
        };
      } else {
        throw new Error('응답에서 텍스트를 찾을 수 없습니다');
      }
      
    } catch (error) {
      console.error(`❌ AI 응답 실패 (${modelName}):`, error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        response: '죄송합니다. AI 응답 생성 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * URL 내용 분석 함수
   */
  async analyzeUrl(url, context = '') {
    try {
      const axios = require('axios');
      const cheerio = require('cheerio');
      
      console.log(`🌐 URL 분석 시작: ${url}`);
      
      // 웹페이지 내용 가져오기
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // HTML 파싱
      const $ = cheerio.load(response.data);
      
      // 제목과 본문 추출
      const title = $('title').text().trim() || $('h1').first().text().trim() || 'Unknown Title';
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
      
      // 주요 텍스트 내용 추출 (p, h1-h6 태그)
      let mainContent = '';
      $('p, h1, h2, h3, h4, h5, h6').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text && text.length > 10) { // 의미있는 텍스트만
          mainContent += text + '\n';
        }
      });
      
      // 내용이 너무 길면 앞부분만 (3000자 제한)
      if (mainContent.length > 3000) {
        mainContent = mainContent.substring(0, 3000) + '...';
      }
      
      const webContent = `
제목: ${title}
설명: ${description}
URL: ${url}

주요 내용:
${mainContent}
`;

      // AI로 웹페이지 내용 요약 및 분석
      const prompt = `
다음 웹페이지 내용을 분석해서 요약해주세요. 햄이 보낸 링크입니다.

컨텍스트: "${context}"

웹페이지 정보:
${webContent}

다음 JSON 형식으로 응답해주세요:
{
  "action": "CHAT",
  "response": "웹페이지 요약 내용 (항상 !!!!! 다나까 말투로)",
  "data": {
    "title": "페이지 제목",
    "summary": "요약",
    "url": "${url}",
    "canSaveAsMemo": true/false,
    "extractedInfo": "일정이나 할일 정보가 있다면 추출"
  }
}

웹페이지 내용을 간단히 요약하고, 일정이나 할일, 메모로 저장할 만한 정보가 있는지 판단해주세요.
항상 "!!!!! 다나까" 말투로 응답하세요.
`;

      const aiResult = await this.generateResponse(prompt);
      
      if (aiResult.success) {
        console.log(`🌐 URL 분석 완료: ${url}`);
        return {
          success: true,
          response: aiResult.response,
          webContent: webContent,
          metadata: {
            url,
            title,
            description,
            contentLength: mainContent.length
          }
        };
      } else {
        throw new Error('AI 분석 실패');
      }
      
    } catch (error) {
      console.error('URL 분석 오류:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        response: `🌐 URL 분석 중 오류가 발생했다나까!!!!! "${url}" 사이트에 접근할 수 없다나까!!!!! 다른 링크를 시도해보시다나까!!!!!`
      };
    }
  }
}

module.exports = new AIService();