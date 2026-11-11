export const release = '0001df2';
export const films = [
  {
    id: 13,
    composition: 'MinutrelCustomSubcategoriesEN',
    slug: 'custom-subcategories',
    title: 'Make categories your own.',
    shortTitle: 'Custom subcategories',
    summary: 'Create a project subcategory and keep it with a time entry and its work description.',
    icon: 'layers',
    intro: ['Organise time around the work you actually do.'],
    steps: [
      {
        key: 'create',
        title: 'Create a subcategory',
        cues: [
          'New projects start with an empty list.',
          'In Subcategories, type a name that fits your work.',
        ],
      },
      {
        key: 'record',
        title: 'Record the work',
        cues: [
          'Choose the project and your new subcategory.',
          'Add the time and a description of what you did.',
        ],
      },
      {
        key: 'review',
        title: 'Find the detail later',
        cues: [
          'The label and description stay with the entry.',
          'The same subcategory is available in the timer and in exports.',
        ],
      },
    ],
    outro: ['Start with a project. Add categories as you need them.'],
  },
  {
    id: 14,
    composition: 'MinutrelProjectPlanningEN',
    slug: 'project-planning',
    title: 'From a plan to tracked work.',
    shortTitle: 'Project budgets and actions',
    summary: 'Set a project budget and deadline, assign an action, and attach it to actual work.',
    icon: 'projects',
    intro: ['Give a project a time budget. Then connect the plan to actual work.'],
    steps: [
      {
        key: 'budget',
        title: 'Set the budget and deadline',
        cues: [
          'In Edit project, set a time budget and a deadline.',
          'The overview shows recorded time and what is left.',
        ],
      },
      {
        key: 'action',
        title: 'Create and assign an action',
        cues: [
          'Add one piece of work as an action.',
          'Choose a subcategory, an owner, planned dates and an estimate.',
        ],
      },
      {
        key: 'link',
        title: 'Link the action to actual work',
        cues: [
          'Choose the project and matching subcategory.',
          'Select the action, describe the work and save the entry.',
        ],
      },
    ],
    outro: ['Use project planning with a team or on your own computer.'],
  },
  {
    id: 15,
    composition: 'MinutrelGanttWorkloadEN',
    slug: 'gantt-workload-rates',
    title: 'See the work ahead.',
    shortTitle: 'Gantt, workload and rates',
    summary: 'Change the Gantt period, spot overload and see estimated amounts from hourly rates.',
    icon: 'calendar',
    intro: ['See when work lands, who has room, and what it could cost.'],
    steps: [
      {
        key: 'period',
        title: 'Choose a planning period',
        cues: [
          'Open Gantt in a project.',
          'Switch from weeks to months or years, or choose custom dates.',
        ],
      },
      {
        key: 'capacity',
        title: 'Spot an overloaded week',
        cues: [
          'Workload spreads estimates across working days.',
          'Enter a weekly capacity to see where planned work exceeds it.',
        ],
      },
      {
        key: 'rate',
        title: 'Set an hourly rate',
        cues: ['As an administrator, open Team.', 'Set a rate and currency for a member.'],
      },
      {
        key: 'estimate',
        title: 'Read the estimated amount',
        cues: [
          'In Workload, planned hours times the rate give an estimate.',
          'In a team, only administrators see the rates and amounts.',
        ],
      },
    ],
    outro: ['Adjust the plan before the week fills up.'],
  },
  {
    id: 16,
    composition: 'MinutrelWeeklyTimesheetsEN',
    slug: 'weekly-timesheets',
    title: 'From weekly hours to approved reports.',
    shortTitle: 'Weekly timesheets',
    summary: 'Submit a week as a member, approve it as a manager, then export the approved time.',
    icon: 'report',
    intro: ['Submit the week, review the hours, then export only what is approved.'],
    steps: [
      {
        key: 'submit',
        role: 'Team member',
        title: 'Submit the week',
        cues: [
          'Open Timesheets from Time entries and choose the week.',
          'Finish timers and sync pending entries before submitting.',
        ],
      },
      {
        key: 'approve',
        role: 'Manager',
        title: 'Review the hours',
        cues: [
          'Select the team member and review the entries.',
          'Approve the sheet, or return it for correction with a reason.',
        ],
      },
      {
        key: 'export',
        role: 'Administrator',
        title: 'Export approved time',
        cues: [
          'In Reports, select the month and enable Approved time only.',
          'Download CSV, PDF or ZIP for the approved hours.',
        ],
      },
    ],
    outro: ['One weekly review. A clear monthly export.'],
  },
];

export const clipsFor = (film) => [
  { key: 'intro', cues: film.intro },
  ...film.steps,
  { key: 'outro', cues: film.outro },
];
