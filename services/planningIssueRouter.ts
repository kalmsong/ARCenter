export type PlanningLawReference = {
  target: 'law' | 'ordin';
  lawId: string;
  title: string;
};

export type PlanningIssueProfile = {
  id: string;
  title: string;
  keywords: RegExp;
  laws: PlanningLawReference[];
  requiredInputs: string[];
  responseGuide: string[];
};

const LAW = (lawId: string, title: string): PlanningLawReference => ({
  target: 'law',
  lawId,
  title,
});

const ISSUE_PROFILES: PlanningIssueProfile[] = [
  {
    id: 'elevator-capacity',
    title: '승강기 대수 및 운행계획 검토',
    keywords: /(엘리베이터|승강기|비상용승강기|피난용승강기|승강기\s*대수|코어\s*대수)/i,
    laws: [
      LAW('001823', '건축법'),
      LAW('002118', '건축법 시행령'),
      LAW('006188', '건축물의 설비기준 등에 관한 규칙'),
      LAW('004948', '주택건설기준 등에 관한 규정'),
    ],
    requiredInputs: [
      '건축물 주용도와 층별 복합용도',
      '지상·지하 층수와 건축물 높이',
      '용도별 바닥면적 또는 연면적',
      '공동주택은 세대수, 호텔은 객실수, 업무·판매시설은 예상 상주·방문인원',
      '승용·비상용·피난용·장애인용 승강기의 겸용 여부',
      '코어 수, 운행구간, 조닝 계획과 목표 대기시간',
    ],
    responseGuide: [
      '법에서 요구하는 설치 대상과 최소 구성부터 판정',
      '법정 최소 대수와 교통량을 고려한 계획 권장 대수를 분리',
      '승용·비상용·피난용·서비스용의 겸용 가능 여부를 구분',
      '복합용도·고층부 조닝과 코어별 배치 대안 제시',
      '입력값이 부족하면 임의의 대수를 단정하지 말고 산정표 형태로 필요한 값 요청',
    ],
  },
  {
    id: 'parking-capacity',
    title: '법정 및 계획 주차대수 검토',
    keywords: /(주차대수|주차\s*대수|법정주차|주차계획|주차장)/i,
    laws: [
      LAW('001814', '주차장법'),
      LAW('004946', '주차장법 시행령'),
      LAW('008238', '주차장법 시행규칙'),
    ],
    requiredInputs: [
      '대상지 주소와 적용 자치구 조례',
      '용도별 시설면적과 세대·객실·좌석 등 산정 단위',
      '기계식·자주식 주차 구성',
      '장애인·전기차·확장형·조업주차 등 별도 의무 수량',
    ],
    responseGuide: [
      '용도별 법정 산정식을 분리',
      '복합용도 합산과 소수점 처리 기준 확인',
      '법정 최소와 실제 운영 권장치를 분리',
      '램프·회차·주차모듈을 포함한 평면 영향까지 제안',
    ],
  },
  {
    id: 'egress-fire',
    title: '피난·방화 및 코어계획 검토',
    keywords: /(피난|방화구획|직통계단|피난계단|특별피난계단|출구|보행거리|코어계획)/i,
    laws: [
      LAW('001823', '건축법'),
      LAW('002118', '건축법 시행령'),
      LAW('006189', '건축물의 피난·방화구조 등의 기준에 관한 규칙'),
      LAW('009694', '소방시설법 시행령'),
    ],
    requiredInputs: [
      '층별 용도와 바닥면적',
      '층별 재실인원 또는 수용인원',
      '층수·높이와 지하층 여부',
      '현재 계단·복도·출구 위치 및 보행거리',
    ],
    responseGuide: [
      '필요 계단 수와 종류를 판정',
      '보행거리·중복거리·출구 이격 검토',
      '방화구획과 피난동선 충돌 지점 제시',
      '코어 이동·추가·분리 등 계획 대안 제시',
    ],
  },
  {
    id: 'site-capacity',
    title: '대지 건축가능 규모와 배치 검토',
    keywords: /(건폐율|용적률|건축가능|개발가능|대지분석|배치|높이제한|일조|사선|최대연면적)/i,
    laws: [
      LAW('009294', '국토의 계획 및 이용에 관한 법률'),
      LAW('009419', '국토의 계획 및 이용에 관한 법률 시행령'),
      LAW('001823', '건축법'),
      LAW('002118', '건축법 시행령'),
    ],
    requiredInputs: [
      '정확한 대상지 주소와 대지면적',
      '용도지역·지구·구역과 지구단위계획',
      '접도조건과 도로폭',
      '계획 용도·층수·높이·건축면적·연면적',
    ],
    responseGuide: [
      '법정 상한과 현재 계획값 비교',
      '도로·일조·높이·공개공지 등 실제 제약을 중첩',
      '가능 규모를 단일 숫자가 아닌 범위와 시나리오로 제시',
      '배치와 매스 조정 대안까지 연결',
    ],
  },
];

export function detectPlanningIssue(prompt: string): PlanningIssueProfile | null {
  return ISSUE_PROFILES.find((profile) => profile.keywords.test(prompt)) ?? null;
}

export function buildPlanningIssueContext(
  prompt: string,
  projectContext?: Record<string, unknown> | null,
): {
  profile: PlanningIssueProfile | null;
  context: string;
  laws: PlanningLawReference[];
} {
  const profile = detectPlanningIssue(prompt);
  if (!profile) {
    return { profile: null, context: '', laws: [] };
  }

  const compactProject = projectContext
    ? JSON.stringify(projectContext).slice(0, 12_000)
    : '등록된 계획정보 없음';

  const context = `\n\n[계획 문제 유형]\n${profile.title}\n\n[현재 프로젝트 정보]\n${compactProject}\n\n[산정에 필요한 입력값]\n- ${profile.requiredInputs.join('\n- ')}\n\n[답변 구성 지침]\n- ${profile.responseGuide.join('\n- ')}`;

  return {
    profile,
    context,
    laws: profile.laws,
  };
}
