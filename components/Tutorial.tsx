import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Info, Database, ShieldCheck, Briefcase, MessageSquare, FolderTree } from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetId?: string;
}

interface TutorialProps {
  onClose: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: TutorialStep[] = [
    {
      title: "Archi-Legal Assistant에 오신 것을 환영합니다!",
      description: "건축 법규 검토와 프로젝트 관리를 돕는 스마트 AI 비서입니다. 복잡한 법규를 대화로 쉽게 확인하고 관리해보세요.",
      icon: <Info size={24} className="text-blue-500" />
    },
    {
      title: "라이브러리 탭",
      description: "자료실과 현재 관리 중인 자료들을 확인할 수 있는 메인 탭입니다.",
      icon: <Database size={24} className="text-blue-600" />,
      targetId: "tutorial-tab-library"
    },
    {
      title: "자료실 (폴더 구조)",
      description: "법령, 지침, 참고 자료를 폴더별로 체계적으로 관리할 수 있습니다. '+ 그룹 추가' 버튼으로 새로운 카테고리를 만들어보세요.",
      icon: <FolderTree size={24} className="text-blue-500" />,
      targetId: "tutorial-subtab-groups"
    },
    {
      title: "현재 목록 (자료 관리)",
      description: "선택한 폴더 안에 URL을 등록하거나 파일을 업로드하세요. AI는 이 목록에 있는 자료들을 실시간으로 분석하여 답변의 근거로 활용합니다.",
      icon: <Database size={24} className="text-blue-600" />,
      targetId: "tutorial-subtab-assets"
    },
    {
      title: "워크스페이스 탭",
      description: "내 프로젝트와 개인적인 검토 원칙을 관리하는 공간입니다.",
      icon: <Briefcase size={24} className="text-purple-500" />,
      targetId: "tutorial-tab-workspace"
    },
    {
      title: "내 프로젝트",
      description: "진행 중인 프로젝트별로 자료를 모아보세요. 프로젝트 생성 시 '대상지 주소'를 입력하면 관련 법규(조례 등)를 AI가 자동으로 찾아 제안해 드립니다.",
      icon: <Briefcase size={24} className="text-purple-500" />,
      targetId: "tutorial-subtab-projects"
    },
    {
      title: "나의 원칙",
      description: "자주 사용하는 설계 기준이나 본인만의 검토 원칙을 등록하세요. '활성화'된 원칙은 모든 대화에서 AI가 최우선적으로 고려합니다.",
      icon: <ShieldCheck size={24} className="text-orange-500" />,
      targetId: "tutorial-subtab-rules"
    },
    {
      title: "스마트 채팅 & 웹 검색",
      description: "채팅창의 이 아이콘을 누르면 실시간 웹 검색이 활성화됩니다. 최신 개정 법령이나 뉴스 정보를 함께 확인할 때 유용합니다.",
      icon: <MessageSquare size={24} className="text-blue-600" />,
      targetId: "tutorial-web-search"
    }
  ];

  useEffect(() => {
    const step = steps[currentStep];
    if (step.targetId) {
      const element = document.getElementById(step.targetId);
      if (element) {
        // If it's a tab, we might need to click it to make sub-tabs visible
        if (step.targetId === "tutorial-tab-library" || step.targetId === "tutorial-tab-workspace" || 
            step.targetId === "tutorial-subtab-groups" || step.targetId === "tutorial-subtab-assets" ||
            step.targetId === "tutorial-subtab-projects" || step.targetId === "tutorial-subtab-rules") {
          element.click();
        }
        
        // Wait a bit for UI to update if clicked
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' as const, placement: 'center' };

    const padding = 28;
    const tooltipWidth = 360;
    const estimatedHeight = 300;
    const { innerWidth: windowWidth, innerHeight: windowHeight } = window;

    // Determine placement based on available space
    let placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    if (windowHeight - targetRect.bottom > estimatedHeight + padding) placement = 'bottom';
    else if (targetRect.top > estimatedHeight + padding) placement = 'top';
    else if (windowWidth - targetRect.right > tooltipWidth + padding) placement = 'right';
    else if (targetRect.left > tooltipWidth + padding) placement = 'left';

    let top = 0, left = 0, transform = 'none';

    if (placement === 'bottom') {
      top = targetRect.bottom + padding;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    } else if (placement === 'top') {
      top = targetRect.top - padding;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      transform = 'translateY(-100%)';
    } else if (placement === 'right') {
      top = targetRect.top + targetRect.height / 2 - estimatedHeight / 2;
      left = targetRect.right + padding;
    } else if (placement === 'left') {
      top = targetRect.top + targetRect.height / 2 - estimatedHeight / 2;
      left = targetRect.left - padding;
      transform = 'translateX(-100%)';
    }

    // Keep on screen
    const margin = 12;
    left = Math.max(margin, Math.min(windowWidth - tooltipWidth - margin, left));
    
    if (placement === 'top') {
      top = Math.max(estimatedHeight + margin, Math.min(windowHeight - margin, top));
    } else if (placement === 'bottom') {
      top = Math.max(margin, Math.min(windowHeight - estimatedHeight - margin, top));
    } else {
      top = Math.max(margin, Math.min(windowHeight - estimatedHeight - margin, top));
    }

    return { top: `${top}px`, left: `${left}px`, position: 'fixed' as const, transform, transition: 'all 0.4s ease', placement };
  };

  const tooltipStyle = getTooltipStyle();
  const placement = tooltipStyle.placement;

  const getArrowStyle = () => {
    if (!targetRect || placement === 'center') return { display: 'none' };
    const tLeft = parseFloat(tooltipStyle.left), tTop = parseFloat(tooltipStyle.top);
    const styles: any = { 
      position: 'absolute', 
      width: '12px', 
      height: '12px', 
      backgroundColor: 'white', 
      transform: 'rotate(45deg)',
      borderStyle: 'solid',
      borderColor: '#f3f4f6',
      borderTopWidth: '0px',
      borderLeftWidth: '0px',
      borderBottomWidth: '0px',
      borderRightWidth: '0px'
    };
    
    if (placement === 'bottom') {
      styles.top = '-6px';
      styles.left = targetRect.left + targetRect.width / 2 - tLeft - 6;
      styles.borderTopWidth = '1px';
      styles.borderLeftWidth = '1px';
    } else if (placement === 'top') {
      styles.bottom = '-6px';
      styles.left = targetRect.left + targetRect.width / 2 - tLeft - 6;
      styles.borderBottomWidth = '1px';
      styles.borderRightWidth = '1px';
    } else if (placement === 'right') {
      styles.left = '-6px';
      styles.top = targetRect.top + targetRect.height / 2 - tTop - 6;
      styles.borderBottomWidth = '1px';
      styles.borderLeftWidth = '1px';
    } else if (placement === 'left') {
      styles.right = '-6px';
      styles.top = targetRect.top + targetRect.height / 2 - tTop - 6;
      styles.borderTopWidth = '1px';
      styles.borderRightWidth = '1px';
    }
    return styles;
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Spotlight Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-all duration-500" 
           style={{
             clipPath: targetRect 
               ? `polygon(0% 0%, 0% 100%, ${targetRect.left}px 100%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.bottom}px, ${targetRect.left}px 100%, 100% 100%, 100% 0%)`
               : 'none'
           }}
      />

      {/* Tooltip */}
      <div 
        ref={tooltipRef}
        className="bg-white rounded-2xl shadow-2xl w-[360px] overflow-visible animate-in fade-in zoom-in duration-300 pointer-events-auto z-[101] border border-gray-100"
        style={tooltipStyle}
      >
        {/* Arrow */}
        <div style={getArrowStyle()} />

        <div className="p-8 flex flex-col relative bg-white rounded-2xl">
          <div className="mb-6 w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl">
            {steps[currentStep].icon}
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-3 break-keep">
            {steps[currentStep].title}
          </h2>
          
          <p className="text-[15px] text-gray-500 leading-relaxed mb-8 break-keep">
            {steps[currentStep].description}
          </p>
          
          <div className="flex items-center gap-1.5 mb-8">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-blue-600' : 'w-2 bg-gray-100'}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between w-full gap-4">
            <button 
              onClick={prevStep}
              className={`flex items-center gap-1 px-2 py-2 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors ${currentStep === 0 ? 'invisible' : ''}`}
            >
              <ChevronLeft size={18} /> 이전
            </button>
            
            <button 
              onClick={nextStep}
              className="flex-grow flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-100"
            >
              {currentStep === steps.length - 1 ? "시작하기" : "다음"}
              {currentStep !== steps.length - 1 && <ChevronRight size={18} />}
            </button>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Highlight Box (Optional, for extra emphasis) */}
      {targetRect && (
        <div 
          className="fixed border-2 border-blue-500 rounded-lg pointer-events-none z-[102] animate-pulse"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}
    </div>
  );
};

export default Tutorial;
