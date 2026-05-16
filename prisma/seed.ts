import { PrismaClient, GrantType, ProjectStatus, Role, BudgetCategory, MilestoneStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up all existing data to avoid duplicates
  await prisma.expenditure.deleteMany({})
  await prisma.milestone.deleteMany({})
  await prisma.document.deleteMany({})
  await prisma.personnelRecord.deleteMany({})
  await prisma.budgetHead.deleteMany({})
  await prisma.project.deleteMany({})
  await prisma.user.deleteMany({})

  console.log('🧹 Cleaned up existing data')

  const pi1 = await prisma.user.create({
    data: {
      name: 'Dr. Rajesh Sharma',
      email: 'dr.sharma@iitd.ac.in',
      password: await bcrypt.hash('password123', 12),
      role: Role.PI,
      employeeId: 'IITD-001',
      institution: 'Indian Institute of Technology Delhi',
      designation: 'Associate Professor',
      phone: '9876543210',
    },
  })

  const copi1 = await prisma.user.create({
    data: {
      name: 'Dr. Priya Mehta',
      email: 'dr.priya@iitd.ac.in',
      password: await bcrypt.hash('password123', 12),
      role: Role.CO_PI,
      employeeId: 'IITD-002',
      institution: 'Indian Institute of Technology Delhi',
      designation: 'Assistant Professor',
      phone: '9876543211',
    },
  })

  const jrf1 = await prisma.user.create({
    data: {
      name: 'Rahul Kumar',
      email: 'rahul.jrf@iitd.ac.in',
      password: await bcrypt.hash('password123', 12),
      role: Role.JRF,
      employeeId: 'IITD-JRF-001',
      institution: 'Indian Institute of Technology Delhi',
      designation: 'Junior Research Fellow',
      phone: '9876543212',
    },
  })

  console.log('✅ Users created')

  const project1 = await prisma.project.create({
    data: {
      title: 'Development of AI-based Early Detection System for Crop Diseases',
      shortTitle: 'AI Crop Disease Detection',
      grantType: GrantType.ARG,
      sanctionNumber: 'ANRF/ARG/2024/001234',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2027-03-31'),
      status: ProjectStatus.ACTIVE,
      hostInstitution: 'Indian Institute of Technology Delhi',
      abstractText: 'This project aims to develop an AI-based system for early detection of crop diseases using deep learning and computer vision techniques.',
      totalBudget: 4500000,
      piId: pi1.id,
    },
  })

  await prisma.budgetHead.createMany({
    data: [
      { projectId: project1.id, category: BudgetCategory.RECURRING, headName: 'Manpower', allocatedAmount: 1800000 },
      { projectId: project1.id, category: BudgetCategory.RECURRING, headName: 'Consumables', allocatedAmount: 400000 },
      { projectId: project1.id, category: BudgetCategory.RECURRING, headName: 'Travel', allocatedAmount: 200000 },
      { projectId: project1.id, category: BudgetCategory.NON_RECURRING, headName: 'Equipment', allocatedAmount: 1800000 },
      { projectId: project1.id, category: BudgetCategory.NON_RECURRING, headName: 'Software', allocatedAmount: 300000 },
    ],
  })

  await prisma.milestone.createMany({
    data: [
      {
        projectId: project1.id,
        title: 'Literature Review and Dataset Collection',
        description: 'Complete literature review and collect crop disease datasets',
        dueDate: new Date('2024-09-30'),
        status: MilestoneStatus.COMPLETED,
        completedAt: new Date('2024-09-15'),
        createdById: pi1.id,
      },
      {
        projectId: project1.id,
        title: 'Model Development and Training',
        description: 'Develop and train deep learning models for disease detection',
        dueDate: new Date('2025-03-31'),
        status: MilestoneStatus.IN_PROGRESS,
        createdById: pi1.id,
      },
      {
        projectId: project1.id,
        title: 'Field Testing and Validation',
        description: 'Test the model in real field conditions',
        dueDate: new Date('2026-03-31'),
        status: MilestoneStatus.PENDING,
        createdById: pi1.id,
      },
    ],
  })

  await prisma.personnelRecord.create({
    data: { projectId: project1.id, userId: copi1.id, role: Role.CO_PI, joinDate: new Date('2024-04-01') },
  })

  await prisma.personnelRecord.create({
    data: { projectId: project1.id, userId: jrf1.id, role: Role.JRF, joinDate: new Date('2024-04-01'), stipend: 37000 },
  })

  console.log('✅ Project 1 (ARG) created')

  const project2 = await prisma.project.create({
    data: {
      title: 'Quantum Computing Approaches for Drug Discovery and Molecular Simulation',
      shortTitle: 'Quantum Drug Discovery',
      grantType: GrantType.IRG,
      sanctionNumber: 'ANRF/IRG/2024/005678',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2027-06-30'),
      status: ProjectStatus.ACTIVE,
      hostInstitution: 'Indian Institute of Technology Delhi',
      abstractText: 'This project explores quantum computing algorithms for accelerating drug discovery processes and molecular simulations.',
      totalBudget: 8500000,
      piId: pi1.id,
    },
  })

  await prisma.budgetHead.createMany({
    data: [
      { projectId: project2.id, category: BudgetCategory.RECURRING, headName: 'Manpower', allocatedAmount: 3000000 },
      { projectId: project2.id, category: BudgetCategory.RECURRING, headName: 'Consumables', allocatedAmount: 500000 },
      { projectId: project2.id, category: BudgetCategory.RECURRING, headName: 'Travel', allocatedAmount: 500000 },
      { projectId: project2.id, category: BudgetCategory.NON_RECURRING, headName: 'Equipment', allocatedAmount: 4000000 },
      { projectId: project2.id, category: BudgetCategory.NON_RECURRING, headName: 'Software Licenses', allocatedAmount: 500000 },
    ],
  })

  await prisma.milestone.createMany({
    data: [
      {
        projectId: project2.id,
        title: 'Quantum Algorithm Design',
        description: 'Design quantum algorithms for molecular simulation',
        dueDate: new Date('2024-12-31'),
        status: MilestoneStatus.IN_PROGRESS,
        createdById: pi1.id,
      },
      {
        projectId: project2.id,
        title: 'Prototype Implementation',
        description: 'Implement prototype on quantum hardware',
        dueDate: new Date('2025-12-31'),
        status: MilestoneStatus.PENDING,
        createdById: pi1.id,
      },
      {
        projectId: project2.id,
        title: 'Drug Candidate Validation',
        description: 'Validate drug candidates using quantum simulations',
        dueDate: new Date('2026-12-31'),
        status: MilestoneStatus.PENDING,
        createdById: pi1.id,
      },
    ],
  })

  console.log('✅ Project 2 (IRG) created')
  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })