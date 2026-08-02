import { supabase } from './supabaseClient';

export const QUICK_START_PROJECT_NAME = '예시 프로젝트 · 서울 업무복합시설';
const LEGACY_QUICK_START_PROJECT_NAME = '빠른 체험 프로젝트';

const CORE_LAW_URLS = [
  {
    id: 'url-law-001823',
    name: '건축법',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=001823',
  },
  {
    id: 'url-law-002118',
    name: '건축법 시행령',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=002118',
  },
  {
    id: 'url-law-006188',
    name: '건축물의 설비기준 등에 관한 규칙',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=006188',
  },
  {
    id: 'url-law-006189',
    name: '건축물의 피난·방화구조 등의 기준에 관한 규칙',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=006189',
  },
  {
    id: 'url-law-009294',
    name: '국토의 계획 및 이용에 관한 법률',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=009294',
  },
  {
    id: 'url-law-009419',
    name: '국토의 계획 및 이용에 관한 법률 시행령',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=009419',
  },
  {
    id: 'url-law-001814',
    name: '주차장법',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=001814',
  },
  {
    id: 'url-law-004946',
    name: '주차장법 시행령',
    url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=004946',
  },
  {
    id: 'url-ord-2000719',
    name: '서울특별시 도시계획 조례',
    url: 'https://www.law.go.kr/ordinInfoP.do?ordinId=2000719',
  },
  {
    id: 'url-ord-2000120',
    name: '서울특별시 건축 조례',
    url: 'https://www.law.go.kr/ordinInfoP.do?ordinId=2000120',
  },
  {
    id: 'url-ord-2000351',
    name: '서울특별시 주차장 설치 및 관리 조례',
    url: 'https://www.law.go.kr/ordinInfoP.do?ordinId=2000351',
  },
];

const SAMPLE_ADDRESS = '서울특별시 마포구 월드컵북로 400';

const SAMPLE_BUILDING_OVERVIEW = {
  exampleVersion: 2,
  exampleDisclaimer:
    '서비스 체험을 위한 가상 계획안입니다. 주소의 실제 현황 및 법적 기준은 API와 원문으로 다시 확인해야 합니다.',
  projectName: QUICK_START_PROJECT_NAME,
  location: SAMPLE_ADDRESS,
  mainUsage: '업무시설 32,000㎡ + 판매시설 6,000㎡ 복합',
  scale: '지하 5층 / 지상 24층',
  buildingHeight: '108m',
  landArea: '8,200㎡',
  buildingArea: '4,510㎡',
  bcr: '55.0%',
  far: '472.0%',
  totalFloorAreaForFar: '38,700㎡',
  totalFloorArea: {
    above: '38,700㎡',
    below: '20,500㎡',
    total: '59,200㎡',
  },
  parkingCount: {
    legal: '미산정',
    planned: '360대',
    plannedRatio: '검토 필요',
  },
  planningInputs: {
    office: {
      floorArea: '32,000㎡',
      estimatedEmployees: '2,200명',
      floors: '6~24층',
    },
    retail: {
      floorArea: '6,000㎡',
      estimatedPeakVisitors: '600명',
      floors: '1~5층',
    },
    elevatorPlan: {
      passenger: '6대',
      service: '1대',
      cores: '2개',
      zoning: '저층·고층 운행 조닝 미적용',
      emergencyAndEvacuationUse: '겸용 가능 여부 미검토',
    },
    egressPlan: {
      stairs: '특별피난계단 2개 계획',
      cores: '업무·판매시설 공용 코어 2개',
      travelDistance: '미검토',
    },
    parkingPlan: {
      total: '360대',
      selfParking: '320대',
      mechanical: '40대',
      ramp: '양방향 램프 1개소',
    },
  },
  notes: {
    parking:
      '용도별 법정 주차대수, 장애인·전기차·확장형·조업주차를 포함해 검토 필요',
  },
};

const WELCOME_MESSAGE = `예시 프로젝트가 준비되었습니다.

GCP 서버 문제로 현재 NCP 임시 서버에서 제한 운영 중입니다. 아래 계획값은 ARCenter의 계획 검토 흐름을 체험하기 위한 가상 예시입니다.

예시 계획안
- 대상지: ${SAMPLE_ADDRESS}
- 용도: 업무시설 32,000㎡ + 판매시설 6,000㎡
- 규모: 지하 5층 / 지상 24층 / 높이 108m
- 대지면적 8,200㎡ / 건축면적 4,510㎡ / 용적률 산정 연면적 38,700㎡
- 예상 이용자: 업무 상주 2,200명 / 판매시설 피크 방문 600명
- 승강기: 승객용 6대 + 서비스용 1대 / 코어 2개 / 운행 조닝 미적용
- 피난: 특별피난계단 2개 계획 / 보행거리 미검토
- 주차: 총 360대(자주식 320대 + 기계식 40대)

아래 초기 질문을 누르면 등록된 프로젝트 값, 대상지 API, 문제별 법령을 조합해 검토합니다. 답변 아래의 ‘근거 원문’에서는 등록된 법령·조례 HTML을 직접 확인할 수 있습니다.

현재 테스트 한도
- 한 질문당 관련 법령 API 최대 4개
- 첨부파일 최대 2개
- 외부 FastAPI 상태에 따라 주소·법령 조회가 지연되거나 실패할 수 있음`;

type GroupRow = {
  id: string;
  name: string;
  parent_id: string | null;
  is_project: boolean | null;
};

async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function ensureTestWorkspace(userId: string): Promise<string> {
  const now = new Date().toISOString();
  const defaultQuickProjectId = `${userId}-000-quick-start`;

  const { data, error } = await supabase
    .from('groups')
    .select('id,name,parent_id,is_project')
    .eq('owner_id', userId);

  if (error) throw error;

  const groups = (data ?? []) as GroupRow[];
  let projectsRoot = groups.find(
    (group) => group.is_project && group.parent_id === null,
  );

  if (!projectsRoot) {
    projectsRoot = {
      id: `${userId}-projects`,
      name: '내 프로젝트',
      parent_id: null,
      is_project: true,
    };

    await upsertRows('groups', [
      {
        id: projectsRoot.id,
        owner_id: userId,
        name: projectsRoot.name,
        parent_id: null,
        is_project: true,
        urls: [],
        files: [],
        created_at: now,
        updated_at: now,
      },
    ]);
  }

  if (groups.length === 0) {
    const lawRootId = `${userId}-root`;
    const nationalLawsId = `${userId}-national-laws`;
    const coreLawsId = `${userId}-test-core-laws`;

    await upsertRows('groups', [
      {
        id: lawRootId,
        owner_id: userId,
        name: '법령·조례 원문',
        parent_id: null,
        is_project: false,
        urls: [],
        files: [],
        created_at: now,
        updated_at: now,
      },
      {
        id: nationalLawsId,
        owner_id: userId,
        name: '예시 프로젝트 기본 자료',
        parent_id: lawRootId,
        is_project: false,
        urls: [],
        files: [],
        created_at: now,
        updated_at: now,
      },
      {
        id: coreLawsId,
        owner_id: userId,
        name: '국가법령·서울시 조례',
        parent_id: nationalLawsId,
        is_project: false,
        urls: CORE_LAW_URLS,
        files: [],
        created_at: now,
        updated_at: now,
      },
    ]);
  }

  const existingQuickProject = groups.find(
    (group) =>
      group.id === defaultQuickProjectId ||
      group.name === QUICK_START_PROJECT_NAME ||
      group.name === LEGACY_QUICK_START_PROJECT_NAME,
  );
  const quickProjectId = existingQuickProject?.id ?? defaultQuickProjectId;

  // 예시 프로젝트는 체험 데이터가 항상 동일하도록 로그인 시 최신 예시값으로 갱신합니다.
  await upsertRows('groups', [
    {
      id: quickProjectId,
      owner_id: userId,
      name: QUICK_START_PROJECT_NAME,
      parent_id: projectsRoot.id,
      project_address: SAMPLE_ADDRESS,
      project_addresses: [SAMPLE_ADDRESS],
      lot_area: '8,200㎡',
      site_investigation:
        '가상 업무·판매 복합 계획안. 북측 주도로와 남측 보조도로를 가정하며 실제 접도·지구단위계획·용도지역은 API 및 원문 확인 필요.',
      is_project: true,
      urls: CORE_LAW_URLS,
      files: [],
      building_overview: SAMPLE_BUILDING_OVERVIEW,
      created_at: now,
      updated_at: now,
    },
  ]);

  const quickSessionId = `${quickProjectId}-welcome`;
  const quickMessageId = `${quickSessionId}-message`;

  await upsertRows('chat_sessions', [
    {
      id: quickSessionId,
      owner_id: userId,
      group_id: quickProjectId,
      title: '예시 계획 검토 시작',
      created_at: now,
      updated_at: now,
      is_archived: false,
    },
  ]);

  await upsertRows('chat_messages', [
    {
      id: quickMessageId,
      owner_id: userId,
      group_id: quickProjectId,
      session_id: quickSessionId,
      text: WELCOME_MESSAGE,
      sender: 'system',
      timestamp: now,
      url_context: [],
      grounding_chunks: [],
      was_search_enabled: false,
      suggested_rules: [],
    },
  ]);

  return quickProjectId;
}
