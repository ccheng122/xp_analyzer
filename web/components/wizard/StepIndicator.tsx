interface Props {
  steps: string[]
  currentStep: number // 1-indexed
}

export function StepIndicator({ steps, currentStep }: Props) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isCompleted = stepNum < currentStep
        const isActive = stepNum === currentStep
        const isUpcoming = stepNum > currentStep

        return (
          <div key={label} className="flex items-stretch gap-0">
            {/* Connector column */}
            <div className="flex flex-col items-center w-10 shrink-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isActive ? 'bg-indigo-500 text-white ring-4 ring-indigo-100' : ''}
                  ${isUpcoming ? 'bg-slate-200 text-slate-400' : ''}
                `}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              {stepNum < steps.length && (
                <div
                  className={`flex-1 w-0.5 my-1 ${
                    isCompleted ? 'bg-green-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>

            {/* Content column */}
            <div
              className={`flex-1 pb-6 pl-4 ${isUpcoming ? 'opacity-40' : ''}`}
              {...(isActive ? { 'data-testid': 'step-active' } : {})}
              {...(isUpcoming ? { 'data-testid': 'step-upcoming' } : {})}
            >
              <div
                className={`text-sm font-semibold mb-2 ${
                  isCompleted ? 'text-green-600' : isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}
              >
                {label}
                {isActive && (
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 rounded px-1.5 py-0.5 font-medium">
                    current step
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
