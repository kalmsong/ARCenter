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

이번 테스트에서는 6개 핵심 법령 가운데 질문과 관련성이 높은 자료만 제한적으로 확인합니다.

예시 질문
- 건폐율과 용적률은 어떤 법령 순서로 검토해야 하나요?
- 피난계단과 방화구획의 기본 검토 항목을 정리해 주세요.
- 주차대수 검토에 필요한 법령과 추가 지역정보를 알려 주세요.`;

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
  const quickProjectId = `${userId}-000-quick-start`;
  const quickSessionId = `${quickProjectId}-welcome`;
  const quickMessageId = `${quickSessionId}-message`;

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

  const existingQuickProject = groups.some(
    (group) => group.id === quickProjectId || group.name === QUICK_START_PROJECT_NAME,
  );

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
        },
        created_at: now,
        updated_at: now,
      },
    ]);
  }

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
