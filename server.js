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

app.get('/', (req, res) => res.send('Backend is Live with Affiliation support! 🏎️'));

app.post('/api/submit', async (req, res) => {
    try {
        const data = req.body;
        console.log(`\n[데이터 수신] 성함: ${data.userName || data.name} / 소속: ${data.affiliation}`);

        const sheets = await createSheetsInstance();
        const SHEET_NAME = 'sheet1'; 

        const getRows = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAME}!A:A`,
        });

        const rows = getRows.data.values;
        const entryNo = rows ? rows.length : 1;

        /**
         * [수정됨] 구글 시트 컬럼 매핑 - 'affiliation' 필드 추가
         * 시트 컬럼 순서: A:순번, B:일시, C:이름, D:연락처, E:성별, F:지역, G:소속(NEW), H:직급 ...
         */
        const row = [
            entryNo,                                      // A: 순번
            data.timestamp || new Date().toLocaleString(), // B: 일시
            data.userName || data.name,                   // C: 이름
            data.phone,                                   // D: 연락처
            data.gender,                                  // E: 성별
            data.region,                                  // F: 지역
            data.affiliation || 'N/A',                    // G: [추가] 소속 보험사
            data.rank,                                    // H: 직급
            data.team_size,                               // I: 조직 규모
            data.recruit_avg,                             // J: 리크루팅
            data.career,                                  // K: 보험 경력
            data.income,                                  // L: 원천 소득
            data.history,                                 // M: 이직 횟수
            data.style,                                   // N: 영업 방식
            data.client,                                  // O: 주력 고객
            data.port,                                    // P: 주력 상품군
            data.w,                                       // Q: W 연속영업
            data.count,                                   // R: 월 평균 건수
            data.premium,                                 // S: 평균월납보험료
            data.mdrt,                                    // T: MDRT 경험
            data.p13,                                     // U: 13회차 유지율
            data.p25,                                     // V: 25회차 유지율
            data.needs,                                   // W: 현재 불만/니즈
            data.final_bounty,                             // X: 최종 이적료
            data.racer ? data.racer.name : 'N/A',         // Y: 선택 캐릭터
            data.stats ? JSON.stringify(data.stats) : ''  // Z: 능력치 데이터
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${SHEET_NAME}!A2`,
            valueInputOption: 'RAW',
            resource: { values: [row] },
        });

        console.log(`✅ [저장 성공] No.${entryNo} - ${data.userName || data.name} (${data.affiliation})`);
        res.status(200).json({ success: true, entryNo });

    } catch (error) {
        console.error('❌ API 에러:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
