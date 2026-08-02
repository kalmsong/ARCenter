import { supabase } from './supabaseClient';

export const QUICK_START_PROJECT_NAME = '빠른 체험 프로젝트';

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
];

const WELCOME_MESSAGE = `빠른 체험 프로젝트가 준비되었습니다.

GCP 서버 문제로 현재 NCP 임시 서버에서 제한 운영 중입니다.

ARCenter는 법령을 단순 요약하는 챗봇이 아니라, 등록된 대상지와 계획정보를 바탕으로 설계 문제를 검토하는 코파일럿을 목표로 합니다.

사용 방법
- 자료실에는 법령·조례 HTML 링크를 간단히 등록하고 원문을 직접 확인합니다.
- 프로젝트에는 주소, 용도, 층수, 높이, 면적, 세대수 등 현재 계획값을 입력합니다.
- 채팅에서는 질문에 필요한 법령과 대상지 API 정보를 자동으로 선별해 법정 최소, 부족한 입력값, 계획 대안을 함께 정리합니다.

현재 테스트 한도
- 한 질문당 관련 법령 API 최대 4개
- 첨부파일 최대 2개
- 주소·토지·법령 API는 외부 FastAPI 상태에 따라 지연되거나 실패할 수 있음

예시 질문
- 이 계획에서 승강기 법정 최소와 권장 대수를 산정하려면 어떤 값이 더 필요한가요?
- 현재 용도와 면적 기준으로 법정 주차대수를 산정하고 평면상 문제를 짚어주세요.
- 이 대상지와 계획안에서 피난 코어를 몇 개로 나누는 것이 적절한가요?
- 현재 배치에서 건폐율·용적률 외에 실제 개발규모를 줄이는 조건을 찾아주세요.`;

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
        name: '법제처',
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
        name: '기본 법령',
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
        name: '빠른 체험용 핵심 법령 6종',
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
      group.name === QUICK_START_PROJECT_NAME,
  );
  const quickProjectId = existingQuickProject?.id ?? defaultQuickProjectId;

  if (!existingQuickProject) {
    await upsertRows('groups', [
      {
        id: quickProjectId,
        owner_id: userId,
        name: QUICK_START_PROJECT_NAME,
        parent_id: projectsRoot.id,
        is_project: true,
        urls: CORE_LAW_URLS,
        files: [],
        building_overview: {
          projectName: QUICK_START_PROJECT_NAME,
          location: '테스트 대상지를 입력해 보세요.',
          mainUsage: '업무시설 또는 공동주택 등 계획 용도를 입력해 보세요.',
          scale: '지상·지하 층수와 높이를 입력해 보세요.',
        },
        created_at: now,
        updated_at: now,
      },
    ]);
  }

  const quickSessionId = `${quickProjectId}-welcome`;
  const quickMessageId = `${quickSessionId}-message`;

  await upsertRows('chat_sessions', [
    {
      id: quickSessionId,
      owner_id: userId,
      group_id: quickProjectId,
      title: '빠른 체험 시작',
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
