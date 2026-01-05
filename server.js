const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');

// 1. dotenv 설정 (최상단에서 실행)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// 환경 변수 로드 상태 확인 로그
const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.SPREADSHEET_ID;

console.log("========================================");
console.log("📡 서버 설정 실시간 검전기");
console.log('ACCOUNT:', GOOGLE_EMAIL ? '✅ 로드됨' : '❌ 누락');
console.log('KEY:', GOOGLE_KEY ? '✅ 로드됨' : '❌ 누락');
console.log('SHEET ID:', spreadsheetId ? '✅ 로드됨' : '❌ 누락');
console.log("========================================");

/**
 * 2. 구글 인증 및 시트 서비스 인스턴스 생성 함수
 * 에러 발생 지점인 키 가공 로직을 대폭 강화했습니다.
 */
async function createSheetsInstance() {
    if (!GOOGLE_EMAIL || !GOOGLE_KEY) {
        throw new Error(".env 파일에 구글 인증 정보가 없습니다.");
    }

    try {
        // [강화된 키 세척 로직]
        // 1. 역슬래시 두 번(\\n)을 실제 줄바꿈(\n)으로 변경
        // 2. 혹시 포함되었을지 모를 앞뒤 큰따옴표(") 제거
        // 3. 앞뒤 공백 제거
        const formattedKey = GOOGLE_KEY
            .replace(/\\n/g, '\n')
            .replace(/^"|"$/g, '') 
            .trim();

        // 키 형식이 올바른지 최소한의 검사
        if (!formattedKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
            throw new Error("비밀키 형식이 올바르지 않습니다. '-----BEGIN PRIVATE KEY-----'로 시작해야 합니다.");
        }

        // [인증 방식 변경] 위치 기반 인자 대신 옵션 객체 방식으로 전달 (더 안정적)
        const auth = new google.auth.JWT({
            email: GOOGLE_EMAIL,
            key: formattedKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        // 실제 구글 서버에 인증을 시도하여 유효성 검사
        await auth.authorize();
        console.log("🔑 구글 API 인증 토큰 획득 성공!");

        return google.sheets({ version: 'v4', auth });
    } catch (err) {
        console.error("❌ 구글 인증 중 에러 발생:", err.message);
        throw err;
    }
}

app.get('/', (req, res) => res.send('Backend Server is Active!'));

/**
 * 3. 데이터 저장 API
 */
app.post('/api/submit', async (req, res) => {
    try {
        const data = req.body;
        console.log(`\n--------------------------------------------`);
        console.log(`[신규 요청] ${new Date().toLocaleString()}`);
        console.log(`[데이터 확인] 성함: ${data.name || '테스트'}`);

        const sheets = await createSheetsInstance();
        const SHEET_NAME = 'sheet1'; 

        const getRows = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAME}!A:A`,
        });

        const rows = getRows.data.values;
        const entryNo = rows ? rows.length : 1;

        const row = [
            entryNo,
            data.timestamp || new Date().toLocaleString(),
            data.name, data.phone, data.gender, data.region,
            data.rank, data.team_size, data.recruit_avg,
            data.career, data.income, data.history,
            data.style, data.client, data.portfolio,
            data.continuance_w, data.perf_count, data.perf_premium,
            data.mdrt, data.p13, data.p25,
            data.needs, data.final_bounty, data.racer_type,
            JSON.stringify(data.stats)
        ];

        const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${SHEET_NAME}!A2`,
            valueInputOption: 'RAW',
            resource: { values: [row] },
        });

        if (appendResponse.status === 200) {
            console.log(`✅ [저장 성공] No.${entryNo} - ${data.name} 님의 데이터가 기록되었습니다.`);
            res.status(200).json({ success: true, entryNo });
        }

    } catch (error) {
        console.error('\n--- ❌ 최종 에러 진단 리포트 ---');
        console.error('메시지:', error.message);
        
        if (error.message.includes('unregistered callers') || error.message.includes('No key')) {
            console.error('💡 원인: 인증 키가 유효하지 않거나 API가 꺼져있습니다.');
        } else if (error.code === 403) {
            console.error('💡 원인: 시트 [공유] 설정에 서비스 계정 이메일을 추가하지 않았습니다.');
        }
        console.error('---------------------------\n');
        
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, async () => {
    console.log(`========================================`);
    console.log(`  FA SCOUTER BACKEND SERVER STARTED!    `);
    console.log(`  포트: ${PORT} / 시트탭: sheet1         `);
    console.log(`========================================`);

    try {
        console.log("📡 구글 API 인증 테스트 시작...");
        await createSheetsInstance();
    } catch (e) {
        console.error("⚠️ 초기 인증 테스트 실패. 환경 변수의 KEY 형식을 다시 확인하세요.");
    }
});