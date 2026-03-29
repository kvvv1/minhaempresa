export interface TransactionScoreInput {
  type: 'INCOME' | 'EXPENSE'
  amount: number
  date: Date | string
}

export interface BudgetScoreInput {
  limit: number
}

export interface HabitScoreInput {
  streak?: number | null
}

export interface HabitLogScoreInput {
  date: Date | string
  completed: boolean
}

export interface TaskScoreInput {
  status?: string | null
  dueDate?: Date | string | null
}

export interface GoalScoreInput {
  status: string
  progress?: number | null
}

export interface ContactScoreInput {
  lastContact?: Date | string | null
}

export interface InteractionScoreInput {
  date: Date | string
}

export interface BookScoreInput {
  status: string
}

export interface CourseScoreInput {
  status: string
}

export interface SkillScoreInput {
  id: string
}

export interface WorkoutScoreInput {
  date: Date | string
}

export interface BodyMetricScoreInput {
  id: string
}

export interface SleepLogScoreInput {
  date: Date | string
  durationMin: number
}

export interface MealScoreInput {
  date: Date | string
  proteinG?: number | null
  calories?: number | null
}

export interface SubjectScoreInput {
  currentGrade?: number | null
}

export interface AssignmentScoreInput {
  status: string
}

export interface StudySessionScoreInput {
  startAt: Date | string
  durationMin?: number | null
}

export interface ProjectScoreInput {
  id: string
}

export interface GtdTaskScoreInput {
  bucket: string
  status: string
  updatedAt: Date | string
}

export function scoreFinanceiro(transactions: TransactionScoreInput[], budgets: BudgetScoreInput[]): number {
  let score = 0
  if (transactions.length === 0) return 0

  score += 20

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthTx = transactions.filter((transaction) => new Date(transaction.date) >= monthStart)
  const income = monthTx.filter((transaction) => transaction.type === 'INCOME').reduce((sum, transaction) => sum + transaction.amount, 0)
  const expense = monthTx.filter((transaction) => transaction.type === 'EXPENSE').reduce((sum, transaction) => sum + transaction.amount, 0)

  if (income > 0) score += 20
  if (income > expense) score += 30
  else if (income > 0 && expense > 0) score += 10

  const savingsRate = income > 0 ? (income - expense) / income : 0
  if (savingsRate >= 0.2) score += 30
  else if (savingsRate >= 0.1) score += 20
  else if (savingsRate >= 0) score += 10

  if (budgets.length > 0) score += 10

  return Math.min(100, score)
}

export function scoreRotina(habits: HabitScoreInput[], habitLogs: HabitLogScoreInput[], tasks: TaskScoreInput[]): number {
  if (habits.length === 0 && tasks.length === 0) return 0
  let score = 0

  if (habits.length > 0) score += 20
  if (tasks.length > 0) score += 10

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentLogs = habitLogs.filter((log) => new Date(log.date) >= sevenDaysAgo)
  const completedLogs = recentLogs.filter((log) => log.completed)
  const completionRate = recentLogs.length > 0 ? completedLogs.length / recentLogs.length : 0

  if (completionRate >= 0.8) score += 40
  else if (completionRate >= 0.5) score += 25
  else if (completionRate > 0) score += 10

  const avgStreak = habits.length > 0
    ? habits.reduce((sum, habit) => sum + (habit.streak || 0), 0) / habits.length
    : 0
  if (avgStreak >= 14) score += 30
  else if (avgStreak >= 7) score += 20
  else if (avgStreak >= 3) score += 10

  return Math.min(100, score)
}

export function scoreMetas(goals: GoalScoreInput[]): number {
  if (goals.length === 0) return 0
  let score = 20

  const active = goals.filter((goal) => goal.status === 'ACTIVE')
  const completed = goals.filter((goal) => goal.status === 'COMPLETED')

  if (active.length > 0) score += 20
  if (completed.length > 0) score += 20

  const avgProgress = active.length > 0
    ? active.reduce((sum, goal) => sum + (goal.progress || 0), 0) / active.length
    : 0
  if (avgProgress >= 70) score += 40
  else if (avgProgress >= 40) score += 25
  else if (avgProgress >= 10) score += 10

  return Math.min(100, score)
}

export function scoreRelacionamentos(contacts: ContactScoreInput[], interactions: InteractionScoreInput[]): number {
  if (contacts.length === 0) return 0
  let score = 20

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const recentInteractions = interactions.filter((interaction) => new Date(interaction.date) >= fourteenDaysAgo)
  if (recentInteractions.length > 0) score += 30
  if (recentInteractions.length >= 3) score += 20

  const contactsWithRecentContact = contacts.filter(
    (contact) => contact.lastContact && new Date(contact.lastContact) >= fourteenDaysAgo
  )
  const coverageRate = contacts.length > 0 ? contactsWithRecentContact.length / contacts.length : 0
  if (coverageRate >= 0.5) score += 30
  else if (coverageRate >= 0.2) score += 15

  return Math.min(100, score)
}

export function scoreDesenvolvimento(books: BookScoreInput[], courses: CourseScoreInput[], skills: SkillScoreInput[]): number {
  let score = 0
  if (books.length === 0 && courses.length === 0 && skills.length === 0) return 0

  if (books.length > 0) score += 15
  if (courses.length > 0) score += 15
  if (skills.length > 0) score += 10

  const readingNow = books.filter((book) => book.status === 'READING').length
  const completedBooks = books.filter((book) => book.status === 'COMPLETED').length
  const inProgressCourses = courses.filter((course) => course.status === 'IN_PROGRESS').length
  const completedCourses = courses.filter((course) => course.status === 'COMPLETED').length

  if (readingNow > 0) score += 20
  if (completedBooks > 0) score += 10
  if (completedBooks >= 3) score += 10
  if (inProgressCourses > 0) score += 10
  if (completedCourses > 0) score += 10

  return Math.min(100, score)
}

export function scoreSaude(
  workouts: WorkoutScoreInput[],
  bodyMetrics: BodyMetricScoreInput[],
  sleepLogs: SleepLogScoreInput[]
): number {
  if (workouts.length === 0 && bodyMetrics.length === 0 && sleepLogs.length === 0) return 0
  let score = 0

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentWorkouts = workouts.filter((workout) => new Date(workout.date) >= sevenDaysAgo)
  if (recentWorkouts.length >= 3) score += 40
  else if (recentWorkouts.length >= 1) score += 20
  else if (workouts.length > 0) score += 10

  const recentSleep = sleepLogs.filter((sleepLog) => new Date(sleepLog.date) >= sevenDaysAgo)
  if (recentSleep.length > 0) {
    const avgMin = recentSleep.reduce((sum, log) => sum + log.durationMin, 0) / recentSleep.length
    if (avgMin >= 420) score += 40
    else if (avgMin >= 360) score += 25
    else score += 10
  }

  if (bodyMetrics.length > 0) score += 20

  return Math.min(100, score)
}

export function scoreNutricao(meals: MealScoreInput[]): number {
  if (meals.length === 0) return 0
  let score = 0

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentMeals = meals.filter((meal) => new Date(meal.date) >= sevenDaysAgo)
  const daysWithMeals = new Set(recentMeals.map((meal) => new Date(meal.date).toDateString())).size

  if (daysWithMeals >= 6) score += 50
  else if (daysWithMeals >= 4) score += 35
  else if (daysWithMeals >= 2) score += 20

  if (recentMeals.some((meal) => meal.proteinG)) score += 30
  if (recentMeals.some((meal) => meal.calories)) score += 20

  return Math.min(100, score)
}

export function scoreFaculdade(
  subjects: SubjectScoreInput[],
  assignments: AssignmentScoreInput[],
  studySessions: StudySessionScoreInput[]
): number {
  if (subjects.length === 0 && assignments.length === 0) return 0
  let score = 0

  if (subjects.length > 0) score += 20

  const gradedSubjects = subjects.filter((subject) => subject.currentGrade != null)
  const avgGrade = gradedSubjects.reduce((sum, subject) => sum + (subject.currentGrade ?? 0), 0) / (gradedSubjects.length || 1)
  if (avgGrade >= 8) score += 40
  else if (avgGrade >= 6) score += 25
  else if (avgGrade > 0) score += 10

  const overdueCount = assignments.filter((assignment) => assignment.status === 'OVERDUE').length
  const pendingCount = assignments.filter((assignment) => ['PENDING', 'IN_PROGRESS'].includes(assignment.status)).length
  if (overdueCount === 0 && pendingCount === 0) score += 20
  else if (overdueCount === 0) score += 10
  else score -= 10

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentStudy = studySessions.filter((session) => new Date(session.startAt) >= sevenDaysAgo && session.durationMin)
  if (recentStudy.length >= 3) score += 20
  else if (recentStudy.length >= 1) score += 10

  return Math.min(100, Math.max(0, score))
}

export function scoreTrabalho(projects: ProjectScoreInput[], tasks: TaskScoreInput[]): number {
  if (projects.length === 0 && tasks.length === 0) return 0
  let score = 0

  if (projects.length > 0) score += 20

  const doneTasks = tasks.filter((task) => task.status === 'DONE').length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? doneTasks / totalTasks : 0
  if (completionRate >= 0.7) score += 40
  else if (completionRate >= 0.4) score += 25
  else if (completionRate > 0) score += 10

  const overdue = tasks.filter((task) => task.status !== 'DONE' && task.dueDate && new Date(task.dueDate) < new Date()).length
  if (overdue === 0) score += 20
  else if (overdue <= 2) score += 10

  if (projects.length > 0) score += 20

  return Math.min(100, score)
}

export function scoreTarefas(gtdTasks: GtdTaskScoreInput[]): number {
  if (gtdTasks.length === 0) return 0
  let score = 0

  const inboxCount = gtdTasks.filter((task) => task.bucket === 'INBOX').length
  const totalActive = gtdTasks.filter((task) => ['PENDING', 'IN_PROGRESS'].includes(task.status)).length

  if (inboxCount === 0) score += 30
  else if (inboxCount <= 5) score += 15

  const completedToday = gtdTasks.filter((task) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return task.status === 'COMPLETED' && new Date(task.updatedAt) >= today
  }).length
  if (completedToday >= 3) score += 40
  else if (completedToday >= 1) score += 25

  if (totalActive > 0) score += 30

  return Math.min(100, score)
}
