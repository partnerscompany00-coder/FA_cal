const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json());

const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.SPREADSHEET_ID;

async function createSheetsInstance() {
    try {
        const formattedKey = GOOGLE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
        const auth = new google.auth.JWT({
            email: GOOGLE_EMAIL,
            key: formattedKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        await auth.authorize();
        return google.sheets({ version: 'v4', auth });
    } catch (err) {
        console.error("❌ 구글 인증 에러:", err.message);
        throw err;
    }
}

app.get('/', (req, res) => res.send('Backend is Live! 🏎️'));

app.post('/api/submit', async (req, res) => {
    try {
        const data = req.body;
        // 디버깅을 위해 수신 데이터 로그 출력
        console.log(`\n[데이터 수신] 성함: ${data.userName || data.name}`);

        const sheets = await createSheetsInstance();
        const SHEET_NAME = 'sheet1'; 

        const getRows = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAME}!A:A`,
        });

        const rows = getRows.data.values;
        const entryNo = rows ? rows.length : 1;

        // 구글 시트 컬럼 매핑 (프론트엔드 userData 키값과 일치시킴)
        const row = [
            entryNo,                                      // A: 순번
            data.timestamp || new Date().toLocaleString(), // B: 일시
            data.userName || data.name,                   // C: 이름
            data.phone,                                   // D: 연락처
            data.gender,                                  // E: 성별
            data.region,                                  // F: 지역
            data.rank,                                    // G: 직급
            data.team_size,                               // H: 조직 규모
            data.recruit_avg,                             // I: 리크루팅
            data.career,                                  // J: 보험 경력
            data.income,                                  // K: 원천 소득
            data.history,                                 // L: 이직 횟수
            data.style,                                   // M: 영업 방식
            data.client,                                  // N: 주력 고객
            data.port,                                    // O: 주력 상품군 (수정됨)
            data.w,                                       // P: W 연속영업 (수정됨)
            data.count,                                   // Q: 월 평균 건수 (수정됨)
            data.premium,                                 // R: 평균월납보험료 (수정됨)
            data.mdrt,                                    // S: MDRT 경험
            data.p13,                                     // T: 13회차 유지율
            data.p25,                                     // U: 25회차 유지율
            data.needs,                                   // V: 현재 불만/니즈
            data.final_bounty,                             // W: 최종 이적료
            data.racer ? data.racer.name : 'N/A',         // X: 선택 캐릭터 (수정됨)
            data.stats ? JSON.stringify(data.stats) : ''  // Y: 능력치 데이터
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${SHEET_NAME}!A2`,
            valueInputOption: 'RAW',
            resource: { values: [row] },
        });

        console.log(`✅ [저장 성공] No.${entryNo} - ${data.userName || data.name}`);
        res.status(200).json({ success: true, entryNo });

    } catch (error) {
        console.error('❌ API 에러:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
