/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { 
  X, MapPin, Ruler, Sparkles, Plus, Trash2, 
  ChevronLeft, Info, Search, Map as MapIcon,
  MessageSquare, ExternalLink, Globe, Layout,
  Check, Save, Navigation, Clock, Pencil, Database,
  Columns, Maximize, FileText, BarChart
} from 'lucide-react';
import { URLGroup, KnowledgeFile } from '../types';
import { fetchOverview, fetchFeasibility } from '../services/airtectApi';

interface ProjectDetailPaneProps {
  projectId: string;
  groups: URLGroup[];
  onClose: () => void;
  onUpdateGroup: (id: string, data: Partial<URLGroup>) => void;
  onStartChat: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const ProjectDetailPane: React.FC<ProjectDetailPaneProps> = ({
  projectId,
  groups,
  onClose,
  onUpdateGroup,
  onStartChat,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const group = groups.find(g => g.id === projectId);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'business' | 'files'>('dashboard');
  
  const [isEditingArea, setIsEditingArea] = useState(false);
  const [areaInput, setAreaInput] = useState(group?.lotArea || '');
  const [newAddressInput, setNewAddressInput] = useState('');
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  
  const [fastApiData, setFastApiData] = useState<any>(null);
  const [feasibilityData, setFeasibilityData] = useState<any>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const [buildingOverview, setBuildingOverview] = useState<any>(group?.buildingOverview || {
    projectName: group?.name || '',
    location: group?.projectAddress || '',
    landCategory: '',
    landArea: '',
    mainUsage: '노인복지주택, 판매시설, 업무시설',
    scale: '주거시설(지상26층)/비주거시설(지상24층)',
    buildingHeight: '108.30 m',
    bcr: '59.52%',
    far: '399.77%',
    buildingArea: '17,546.61',
    totalFloorAreaForFar: '117,860.83',
    totalFloorArea: { above: '155,750.83', below: '0.00', total: '155,750.83' },
    landscapingArea: '4,451.78',
    publicOpenSpace: '2,977.68',
    parkingCount: { legal: '921대', planned: '1,059대', plannedRatio: '115%' },
    legalValues: { bcr: '60%', far: '400%', landscaping: '대지면적의 15%이상', publicOpenSpace: '대지면적의 10%이상', parking: '115%' }
  });

  useEffect(() => {
    if (group?.buildingOverview) {
      setBuildingOverview(group.buildingOverview);
    } else {
      setBuildingOverview({
        projectName: group?.name || '',
        location: group?.projectAddress || '',
        landCategory: '',
        landArea: '',
        mainUsage: '노인복지주택, 판매시설, 업무시설',
        scale: '주거시설(지상26층)/비주거시설(지상24층)',
        buildingHeight: '108.30 m',
        bcr: '59.52%',
        far: '399.77%',
        buildingArea: '17,546.61',
        totalFloorAreaForFar: '117,860.83',
        totalFloorArea: { above: '155,750.83', below: '0.00', total: '155,750.83' },
        landscapingArea: '4,451.78',
        publicOpenSpace: '2,977.68',
        parkingCount: { legal: '921대', planned: '1,059대', plannedRatio: '115%' },
        legalValues: { bcr: '60%', far: '400%', landscaping: '대지면적의 15%이상', publicOpenSpace: '대지면적의 10%이상', parking: '115%' }
      });
    }
  }, [group?.buildingOverview, projectId]);

  const addresses = group?.projectAddresses || (group?.projectAddress ? [group.projectAddress] : []);
  const combinedAddress = addresses.join(',');

  useEffect(() => {
    const loadApiData = async () => {
      if (combinedAddress) {
        setIsLoadingApi(true);
        try {
           const overview = await fetchOverview(combinedAddress);
           setFastApiData(overview);
           
           if (activeTab === 'business' && overview) {
              const fsb = await fetchFeasibility(combinedAddress);
              setFeasibilityData(fsb);
           }
        } catch(e) {
           console.error("Fast API load error", e);
        } finally {
          setIsLoadingApi(false);
        }
      }
    };
    loadApiData();
  }, [combinedAddress, activeTab]);

  const handleSaveBuildingOverview = () => {
    onUpdateGroup(projectId, { buildingOverview });
  };

  if (!group) return null;

  const handleAddAddress = () => {
    if (newAddressInput.trim()) {
      // Split by comma or newline to support multiple addresses at once
      const newAddresses = newAddressInput
        .split(/,|\n/)
        .map(a => a.trim())
        .filter(a => a !== '');
        
      if (newAddresses.length > 0) {
        const updated = [...addresses, ...newAddresses];
        onUpdateGroup(projectId, { 
          projectAddresses: updated,
          projectAddress: updated[0]
        });
      }
      setNewAddressInput('');
      setIsAddingAddress(false);
    }
  };

  const handleRemoveAddress = (index: number) => {
    const updated = addresses.filter((_, i) => i !== index);
    onUpdateGroup(projectId, { 
      projectAddresses: updated,
      projectAddress: updated.length > 0 ? updated[0] : ''
    });
  };

  const handleSaveArea = () => {
    onUpdateGroup(projectId, { lotArea: areaInput });
    setIsEditingArea(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col border-b border-slate-200 bg-white/90 backdrop-blur-xl sticky top-0 z-20 shadow-sm relative">
        <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                {onToggleSidebar && (
                    <button 
                        onClick={onToggleSidebar}
                        className={`p-2.5 rounded-xl transition-all font-bold group ${isSidebarOpen ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                        title={isSidebarOpen ? "자료실 닫기" : "자료실 열기"}
                    >
                        <Layout size={24} className="group-hover:scale-110 transition-transform" />
                    </button>
                )}
                <button 
                    onClick={onClose}
                    className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 group"
                >
                    <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>
            </div>
            <div className="h-12 w-[1px] bg-slate-200 mx-2" />
            <div>
                <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{group.name}</h2>
                <span className="flex items-center gap-1.5 text-[10px] bg-purple-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-lg shadow-purple-100">
                    <Layout size={10} /> Active Project
                </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none opacity-60">Control Dashboard</p>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="text-[10px] text-slate-400 font-black">ID: {group.id.slice(-8).toUpperCase()}</span>
                </div>
            </div>
            </div>
            <div className="flex items-center gap-4">
            <button 
                onClick={onStartChat}
                className="group flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-purple-600 transition-all shadow-2xl shadow-slate-200 hover:shadow-purple-200 active:scale-95"
            >
                <MessageSquare size={20} className="group-hover:rotate-12 transition-transform" />
                AI 법규 상담 시작하기
            </button>
            </div>
        </div>
        
        {/* Tabs */}
        <div className="px-6 flex gap-8 border-t border-slate-100 pt-4">
            {[
              { id: 'dashboard', label: '대시보드', icon: Layout },
              { id: 'analysis', label: '대지분석', icon: Search },
              { id: 'business', label: '사업성 검토', icon: BarChart },
              { id: 'files', label: '참고자료', icon: FileText }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-4 text-sm font-bold transition-all border-b-2 ${activeTab === tab.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-10 space-y-10">
          
          {activeTab === 'dashboard' && (
            <div className="bg-white p-10 rounded-[60px] border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden font-sans">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">건축개요</h3>
                  <p className="text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest">Building Summary Dashboard</p>
                </div>
                <button 
                  onClick={handleSaveBuildingOverview}
                  className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-purple-600 transition shadow-2xl active:scale-95"
                >
                  <Save size={20} /> 현재 개요 저장
                </button>
              </div>
              
              <div className="overflow-x-auto border border-slate-200 rounded-[32px] shadow-inner bg-slate-50/20">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#B3B8A3] text-white">
                      <th className="border border-white/20 p-4 w-1/4 font-black">구분</th>
                      <th className="border border-white/20 p-4 w-1/2 font-black">내용</th>
                      <th className="border border-white/20 p-4 w-1/4 font-black">비고</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {[
                      { label: '사 업 명', field: 'projectName' },
                      { label: '대지위치', field: 'location' },
                      { label: '지역지구', field: 'landCategory' },
                      { label: '대지면적', field: 'landArea' },
                      { label: '주요용도', field: 'mainUsage' },
                      { label: '규 모', field: 'scale' },
                      { label: '건축물의 높이', field: 'buildingHeight' },
                      { label: '건 폐 율', field: 'bcr', legal: 'bcr' },
                      { label: '용 적 률', field: 'far', legal: 'far' },
                      { label: '건축면적', field: 'buildingArea' },
                      { label: '용적률산정연면적', field: 'totalFloorAreaForFar' },
                    ].map((row) => (
                      <tr key={row.field} className="hover:bg-slate-50/50 transition-colors">
                        <td className="border border-slate-200 p-4 bg-[#F2F2F2] font-black text-center text-slate-800">{row.label}</td>
                        <td className="border border-slate-200 p-2">
                          <input 
                            type="text" 
                            value={(buildingOverview as any)[row.field] || ''} 
                            onChange={e => setBuildingOverview({...buildingOverview, [row.field]: e.target.value})}
                            className="w-full bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg text-center text-base font-medium py-2"
                          />
                        </td>
                        <td className="border border-slate-200 p-4 text-center text-slate-500 font-bold bg-[#FAF9F6]">
                          {row.legal && (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-slate-400">법정 : </span>
                              <input 
                                type="text" 
                                value={(buildingOverview.legalValues as any)[row.legal] || ''} 
                                onChange={e => setBuildingOverview({
                                  ...buildingOverview, 
                                  legalValues: {...buildingOverview.legalValues, [row.legal!]: e.target.value}
                                })}
                                className="w-20 bg-transparent border-b border-dashed border-slate-300 focus:border-purple-400 focus:ring-0 p-0 text-center text-slate-600 font-black"
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* 연면적 section */}
                    <tr>
                      <td rowSpan={3} className="border border-slate-200 p-4 bg-[#F2F2F2] font-black text-center text-slate-800">연면적</td>
                      <td className="border border-slate-200 p-2">
                        <div className="flex items-center justify-between px-6">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">지상연면적</span>
                          <input 
                            type="text" 
                            value={buildingOverview.totalFloorArea?.above || ''} 
                            onChange={e => setBuildingOverview({
                              ...buildingOverview, 
                              totalFloorArea: {...buildingOverview.totalFloorArea, above: e.target.value}
                            })}
                            className="text-center w-2/3 p-2 bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg font-medium"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-200 p-4 bg-[#FAF9F6]"></td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2">
                        <div className="flex items-center justify-between px-6">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">지하연면적</span>
                          <input 
                            type="text" 
                            value={buildingOverview.totalFloorArea?.below || ''} 
                            onChange={e => setBuildingOverview({
                              ...buildingOverview, 
                              totalFloorArea: {...buildingOverview.totalFloorArea, below: e.target.value}
                            })}
                            className="text-center w-2/3 p-2 bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg font-medium"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-200 p-4 bg-[#FAF9F6]"></td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2">
                        <div className="flex items-center justify-between px-6 font-black bg-slate-50/50 py-1">
                          <span className="text-sm">합 계</span>
                          <input 
                            type="text" 
                            value={buildingOverview.totalFloorArea?.total || ''} 
                            onChange={e => setBuildingOverview({
                              ...buildingOverview, 
                              totalFloorArea: {...buildingOverview.totalFloorArea, total: e.target.value}
                            })}
                            className="text-center w-2/3 p-2 bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg font-black text-slate-900"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-200 p-4 bg-[#FAF9F6]"></td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-4 bg-[#F2F2F2] font-black text-center text-slate-800">조경면적</td>
                      <td className="border border-slate-200 p-2 text-center">
                        <input 
                          type="text" 
                          value={buildingOverview.landscapingArea || ''} 
                          onChange={e => setBuildingOverview({...buildingOverview, landscapingArea: e.target.value})}
                          className="w-full bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg text-center font-medium py-2"
                        />
                      </td>
                      <td className="border border-slate-200 p-4 text-center text-slate-500 font-bold bg-[#FAF9F6]">
                        <input 
                          type="text" 
                          value={buildingOverview.legalValues?.landscaping || ''} 
                          onChange={e => setBuildingOverview({
                            ...buildingOverview, 
                            legalValues: {...buildingOverview.legalValues, landscaping: e.target.value}
                          })}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-center text-slate-500 text-xs font-black"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-4 bg-[#F2F2F2] font-black text-center text-slate-800">공개공지면적</td>
                      <td className="border border-slate-200 p-2 text-center">
                        <input 
                          type="text" 
                          value={buildingOverview.publicOpenSpace || ''} 
                          onChange={e => setBuildingOverview({...buildingOverview, publicOpenSpace: e.target.value})}
                          className="w-full bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg text-center font-medium py-2"
                        />
                      </td>
                      <td className="border border-slate-200 p-4 text-center text-slate-500 font-bold bg-[#FAF9F6]">
                        <input 
                          type="text" 
                          value={buildingOverview.legalValues?.publicOpenSpace || ''} 
                          onChange={e => setBuildingOverview({
                            ...buildingOverview, 
                            legalValues: {...buildingOverview.legalValues, publicOpenSpace: e.target.value}
                          })}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-center text-slate-500 text-xs font-black"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td rowSpan={2} className="border border-slate-200 p-4 bg-[#F2F2F2] font-black text-center text-slate-800">주차대수</td>
                      <td className="border border-slate-200 p-2">
                        <div className="flex items-center justify-between px-6">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">법정주차대수</span>
                          <input 
                            type="text" 
                            value={buildingOverview.parkingCount?.legal || ''} 
                            onChange={e => setBuildingOverview({
                              ...buildingOverview, 
                              parkingCount: {...buildingOverview.parkingCount, legal: e.target.value}
                            })}
                            className="text-center w-2/3 p-2 bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg font-medium"
                          />
                        </div>
                      </td>
                      <td rowSpan={2} className="border border-slate-200 p-4 text-center align-middle bg-[#FAF9F6]">
                         <input 
                          type="text" 
                          value={buildingOverview.parkingCount?.plannedRatio || ''} 
                          onChange={e => setBuildingOverview({
                            ...buildingOverview, 
                            parkingCount: {...buildingOverview.parkingCount, plannedRatio: e.target.value}
                          })}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-center text-slate-800 font-black text-xl"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2">
                        <div className="flex items-center justify-between px-6 font-black bg-slate-50/50 py-1">
                          <span className="text-xs">계획주차대수</span>
                          <input 
                            type="text" 
                            value={buildingOverview.parkingCount?.planned || ''} 
                            onChange={e => setBuildingOverview({
                              ...buildingOverview, 
                              parkingCount: {...buildingOverview.parkingCount, planned: e.target.value}
                            })}
                            className="text-center w-2/3 p-2 bg-transparent border-none focus:ring-2 focus:ring-purple-500/20 rounded-lg font-black"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Col: Metadata (4/12) */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-xl shadow-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-2 h-full bg-purple-500" />
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Registration</h3>
                    <p className="text-base font-black text-slate-800">대상지 필지 지번 목록</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingAddress(true)}
                    className="w-12 h-12 bg-slate-50 hover:bg-purple-50 rounded-2xl text-slate-400 hover:text-purple-600 transition-all border border-slate-100 flex items-center justify-center"
                  >
                    <Plus size={24} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {addresses.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-[32px]">
                       <MapPin size={32} className="mx-auto text-slate-200 mb-3" />
                       <p className="text-sm text-slate-400 font-bold whitespace-pre-wrap">등록된 필지가\n없습니다.</p>
                    </div>
                  ) : (
                    addresses.map((addr, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50/50 p-5 px-6 rounded-[24px] border border-transparent hover:border-purple-200 hover:bg-white transition-all group/item shadow-sm hover:shadow-md">
                        <div className="flex items-center gap-4 min-w-0">
                           <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-xs font-black text-slate-400 group-hover/item:text-purple-600 transition-colors shadow-sm">
                             {idx + 1}
                           </div>
                           <span className="text-sm text-slate-800 font-black truncate">{addr}</span>
                        </div>
                        <button 
                          onClick={() => handleRemoveAddress(idx)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover/item:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                  
                  {isAddingAddress && (
                    <div className="flex gap-3 mt-6 animate-in slide-in-from-top-6 duration-500">
                      <input 
                        type="text" 
                        value={newAddressInput} 
                        onChange={e => setNewAddressInput(e.target.value)} 
                        placeholder="필지 지번 입력 (여러 개일 경우 콤마로 구분)..." 
                        className="flex-grow text-sm p-4 bg-slate-50 border border-slate-200 rounded-[20px] outline-none focus:ring-4 focus:ring-purple-500/10 focus:bg-white font-bold placeholder:text-slate-300 transition-all" 
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleAddAddress()}
                      />
                      <button onClick={handleAddAddress} className="w-14 h-14 bg-purple-600 text-white rounded-[20px] shadow-xl shadow-purple-200 hover:bg-purple-700 transition-all flex items-center justify-center"><Check size={28} /></button>
                      <button onClick={() => setIsAddingAddress(false)} className="w-14 h-14 bg-white border border-slate-200 text-slate-400 rounded-[20px] hover:bg-slate-50 transition-all flex items-center justify-center"><X size={24} /></button>
                    </div>
                  )}
                </div>
              </section>

              <div className="p-8 bg-white rounded-[40px] border border-slate-100 flex items-center justify-between group shadow-lg shadow-slate-100 hover:shadow-xl transition-all">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-purple-50 group-hover:text-purple-600 transition-all shadow-inner">
                       <Globe size={28} />
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">API Status</p>
                       <p className="text-lg font-black text-slate-900">{fastApiData ? '분석 완료' : isLoadingApi ? '분석 중...' : '대기 중'}</p>
                    </div>
                 </div>
                 <div className={`w-4 h-4 rounded-full shadow-lg ${fastApiData ? 'bg-green-500 shadow-green-500/50' : isLoadingApi ? 'bg-yellow-500 animate-pulse shadow-yellow-500/50' : 'bg-slate-300'}`} />
              </div>
            </div>

            {/* Right Col: Map & Info (8/12) */}
            <div className="lg:col-span-8 flex flex-col gap-10">
               <div className="flex-grow min-h-[400px] rounded-[60px] overflow-hidden border-8 border-white shadow-2xl shadow-slate-300/40 relative bg-slate-100 flex items-center justify-center p-12 text-center group">
                 <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-md flex flex-col p-12 text-left overflow-y-auto custom-scrollbar">
                    {fastApiData ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full w-full">
                           <h4 className="text-3xl font-black text-slate-900 tracking-tight mb-8">대지 요약정보</h4>
                           {fastApiData.land?.landCharacteristics && (
                               <div className="grid grid-cols-2 gap-4 mb-6">
                                   <div className="bg-white p-6 rounded-3xl shadow-sm">
                                      <p className="text-xs font-bold text-slate-400 mb-2">공시지가</p>
                                      <p className="text-xl font-black text-slate-800">{fastApiData.land.landCharacteristics.pblntf_pclnd} 원</p>
                                   </div>
                                    <div className="bg-white p-6 rounded-3xl shadow-sm">
                                      <p className="text-xs font-bold text-slate-400 mb-2">면적</p>
                                      <p className="text-xl font-black text-slate-800">{fastApiData.land.landCharacteristics.lndpcl_ar} m²</p>
                                   </div>
                               </div>
                           )}
                           
                           {fastApiData.regulation?.summary && (
                               <div className="bg-white p-8 rounded-[40px] shadow-sm mb-6 border border-slate-100">
                                   <h5 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                                       <Sparkles className="text-purple-500" size={24}/> 규제 요약
                                   </h5>
                                   <div className="grid grid-cols-2 gap-6">
                                       <div>
                                           <p className="text-sm font-bold text-slate-400 mb-1">용적률 한도</p>
                                           <p className="text-2xl font-black text-slate-900">{fastApiData.regulation.summary.far_max || '확인필요'}%</p>
                                       </div>
                                       <div>
                                           <p className="text-sm font-bold text-slate-400 mb-1">건폐율 한도</p>
                                           <p className="text-2xl font-black text-slate-900">{fastApiData.regulation.summary.bcr_max || '확인필요'}%</p>
                                       </div>
                                       {fastApiData.regulation.summary.floor_max && (
                                           <div className="col-span-2">
                                               <p className="text-sm font-bold text-slate-400 mb-1">최고 층수</p>
                                               <p className="text-xl font-black text-slate-900">{fastApiData.regulation.summary.floor_max}층</p>
                                           </div>
                                       )}
                                       <div className="col-span-2 space-y-2 mt-4">
                                            {fastApiData.regulation.summary.zones.map((zone: string, i: number) => (
                                                <div key={i} className="inline-block px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-sm font-bold mr-2 mb-2">
                                                    {zone}
                                                </div>
                                            ))}
                                       </div>
                                   </div>
                               </div>
                           )}
                           <a href={`/api/airtect/site_shp?address=${encodeURIComponent(combinedAddress || '')}&address_type=road&format=binary`} className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl text-sm font-black hover:bg-purple-700 transition shadow-lg">
                               대지 SHP 다운로드 (GIS)
                           </a>
                        </div>
                    ) : (
                        <div className="m-auto text-center">
                            <div className="w-32 h-32 bg-white rounded-[40px] shadow-sm flex items-center justify-center mb-8 mx-auto">
                            <MapIcon className="text-slate-200" size={56} />
                            </div>
                            <h4 className="text-3xl font-black text-slate-900 tracking-tight">Main Target Site</h4>
                            <p className="text-lg text-slate-500 mt-4 max-w-[440px] font-medium leading-relaxed">
                            {addresses.length > 0 ? (isLoadingApi ? "데이터를 불러오고 있습니다..." : "대상지 주소는 등록되어 있으나 데이터를 불러오지 못했습니다.") : "대지 위치 (지번)가 아직 등록되지 않았습니다."}
                            </p>
                        </div>
                    )}
                 </div>
               </div>
            </div>
          </div>
          )}

          {activeTab === 'business' && (
              <div className="bg-white p-12 rounded-[60px] shadow-xl shadow-slate-100 border border-slate-200 min-h-[500px]">
                  <h3 className="text-3xl font-black text-slate-900 mb-8">사업성 추정</h3>
                  {feasibilityData ? (
                      <div className="space-y-8 animate-in fade-in duration-500">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {Object.entries(feasibilityData.totals || {}).map(([key, val]: [string, any]) => (
                                    <div key={key} className="bg-slate-50 p-6 rounded-3xl">
                                        <p className="text-xs font-bold text-slate-400 uppercase">{key}</p>
                                        <p className="text-2xl font-black text-slate-800 mt-2">
                                            {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                        </p>
                                    </div>
                                ))}
                           </div>
                           
                           {/* Sections representation */}
                           <div className="space-y-6">
                               {feasibilityData.sections?.map((sec: any, i: number) => (
                                   <div key={i} className="border border-slate-100 p-8 rounded-[40px]">
                                       <h4 className="text-xl font-bold text-slate-800 mb-6">{sec.name}</h4>
                                       <table className="w-full text-left">
                                           <thead>
                                               <tr className="text-slate-400 text-sm border-b border-slate-100">
                                                   <th className="pb-4 font-normal">항목</th>
                                                   <th className="pb-4 font-normal">산식/기준</th>
                                                   <th className="pb-4 font-normal text-right">금액 (백만)</th>
                                               </tr>
                                           </thead>
                                           <tbody>
                                               {sec.items?.map((item: any, j: number) => (
                                                   <tr key={j} className="border-b border-slate-50 last:border-0">
                                                       <td className="py-4 font-medium text-slate-700">{item.name}</td>
                                                       <td className="py-4 text-slate-500 text-sm">{item.formula}</td>
                                                       <td className="py-4 font-bold text-slate-900 text-right">{item.amount_million_won ? item.amount_million_won.toLocaleString() : '-'}</td>
                                                   </tr>
                                               ))}
                                           </tbody>
                                       </table>
                                   </div>
                               ))}
                           </div>
                      </div>
                  ) : (
                      <div className="text-center py-20">
                          <p className="text-slate-500 mb-6">사업성 추정 데이터가 없습니다. 사업성 분석을 실행하세요.</p>
                          {addresses.length === 0 ? (
                              <p className="text-red-500 font-bold">대지 지번을 먼저 등록해주세요.</p>
                          ) : (
                              <button onClick={() => {
                                  // Fake reloading state to trigger effect or just trigger manually
                                  setActiveTab('dashboard');
                                  setTimeout(() => setActiveTab('business'), 100);
                              }} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black">
                                  데이터 재요청
                              </button>
                          )}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'files' && (
               <div className="bg-white p-12 rounded-[60px] shadow-xl shadow-slate-100 border border-slate-200 min-h-[500px]">
                   <h3 className="text-3xl font-black text-slate-900 mb-8">프로젝트 메모 및 참고자료</h3>
                   <div className="grid grid-cols-1 gap-6">
                       {group.files.length === 0 ? (
                           <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-[40px]">
                               <p className="text-slate-500">참고자료나 요약된 문서가 없습니다.</p>
                               <p className="text-sm text-slate-400 mt-2">AI와의 대화에서 문서를 요약하거나 마크다운 파일을 업로드하면 여기에 표시됩니다.</p>
                           </div>
                       ) : (
                           group.files.map(file => (
                               <div key={file.id} className="p-6 border border-slate-200 rounded-3xl flex flex-col">
                                   <div className="flex items-center justify-between mb-4">
                                       <span className="font-bold text-slate-800 flex items-center gap-2">
                                           <FileText size={20} className="text-purple-500" />
                                           {file.name}
                                       </span>
                                   </div>
                                   <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                                       {file.content || "바이너리 또는 내용 없음"}
                                   </div>
                               </div>
                           ))
                       )}
                   </div>
               </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPane;
