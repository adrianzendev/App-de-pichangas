import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, tasks, candidates, tutors, favorites, reviews, chatMessages, chatRooms, systemIds, careers, tutorCareers, tutorCertifications } from "@shared/schema";

export async function seedDatabase() {
  try {
    // Skip seed if data already exists
    const existing = await db.select().from(users).limit(1);
    if (existing.length > 0) {
      return;
    }

    console.log("🌱 Seeding database with initial data...");

    // Create users
    const [student1] = await db.insert(users).values({
      name: "Carolina López",
      email: "carolina@estudiante.com",
      university: "Universidad Nacional Mayor de San Marcos",
      country: "PE",
      whatsapp: "+51987654321",
      rating: "4.5",
      tasksPublished: 3,
      tasksCompleted: 0,
      status: "active"
    }).returning();

    const [tutor1] = await db.insert(users).values({
      name: "Dr. Miguel Rodriguez",
      email: "miguel@tutor.com", 
      university: "Universidad de Lima",
      country: "PE",
      whatsapp: "+51912345678",
      rating: "4.8",
      tasksPublished: 0,
      tasksCompleted: 12,
      status: "active"
    }).returning();

    const [tutor2] = await db.insert(users).values({
      name: "Ing. Ana Fernandez",
      email: "ana@tutor.com",
      university: "Pontificia Universidad Católica del Perú",
      country: "PE", 
      whatsapp: "+51998876543",
      rating: "4.7",
      tasksPublished: 0,
      tasksCompleted: 8,
      status: "active"
    }).returning();

    const [student2] = await db.insert(users).values({
      name: "Roberto Silva",
      email: "roberto@estudiante.com",
      university: "Universidad Peruana Cayetano Heredia",
      country: "PE",
      whatsapp: "+51965432109",
      rating: "4.2",
      tasksPublished: 1,
      tasksCompleted: 0,
      status: "active"
    }).returning();

    // Create tutors profiles
    const [tutorProfile1] = await db.insert(tutors).values({
      user_id: tutor1.id,
      specialties: ["Matemáticas", "Física", "Cálculo"],
      profession: "Doctor en Física",
      bio: "Especialista en matemáticas aplicadas con 15 años de experiencia docente.",
      rating: "4.8",
      isVerified: true
    }).returning();

    const [tutorProfile2] = await db.insert(tutors).values({
      user_id: tutor2.id,
      specialties: ["Ingeniería Civil", "AutoCAD", "Estructuras"],
      profession: "Ingeniera Civil",
      bio: "Experta en diseño estructural y software de ingeniería.",
      rating: "4.7", 
      isVerified: true
    }).returning();

    // Add ARTURO TUTOR
    const [arturoUser] = await db.insert(users).values({
      name: "Arturo Tutor",
      email: "arturo.tutor@miltareas.com",
      university: "Universidad Nacional de Ingeniería",
      country: "PE",
      whatsapp: "+51987123456",
      rating: "4.9",
      tasksPublished: 0,
      tasksCompleted: 25,
      status: "active"
    }).returning();

    const [arturoTutorProfile] = await db.insert(tutors).values({
      user_id: arturoUser.id,
      specialties: ["Matemáticas Avanzadas", "Física Cuántica", "Cálculo Diferencial"],
      profession: "Doctor en Matemáticas",
      bio: "Especialista en matemáticas avanzadas con más de 10 años de experiencia en educación superior. Experto en cálculo, álgebra lineal y física cuántica.",
      rating: "4.9",
      isVerified: true
    }).returning();

    // Add official demo students ALUMNO1 and ALUMNO2
    const [alumno1] = await db.insert(users).values({
      name: "ALUMNO1",
      email: "al1@miltareas.com",
      university: "Universidad Nacional de Ingeniería",
      country: "PE",
      whatsapp: "+51987654001",
      rating: "4.3",
      tasksPublished: 1,
      tasksCompleted: 0,
      status: "active",
      // Password will be: 123456 (to be handled by auth system)
    }).returning();

    const [alumno2] = await db.insert(users).values({
      name: "ALUMNO2", 
      email: "al2@miltareas.com",
      university: "Universidad San Martín de Porres",
      country: "PE",
      whatsapp: "+51987654002", 
      rating: "4.1",
      tasksPublished: 2,
      tasksCompleted: 0,
      status: "active",
      // Password will be: 123456 (to be handled by auth system)
    }).returning();

    // Create tasks
    const [task1] = await db.insert(tasks).values({
      userId: student1.id,
      title: "Práctica de Cálculo Diferencial",
      description: "Necesito ayuda con ejercicios de límites y derivadas para mi examen parcial.",
      subject: "Matemáticas",
      studyArea: "Matemáticas",
      budget: "80.00",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      attachments: ["calculo_ejercicios.pdf"],
      status: "active",
      candidateCount: 2
    }).returning();

    const [task2] = await db.insert(tasks).values({
      userId: student1.id,
      title: "Diseño de estructura en AutoCAD",
      description: "Proyecto de diseño de una estructura de acero para edificio de 3 pisos.",
      subject: "Ingeniería",
      studyArea: "Ingeniería",
      budget: "150.00",
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      attachments: ["planos_base.dwg", "especificaciones.pdf"],
      status: "in_progress",
      assignedTutorId: tutor2.id,
      candidateCount: 1
    }).returning();

    const [task3] = await db.insert(tasks).values({
      userId: student2.id,
      title: "Análisis estadístico de datos de mercado",
      description: "Necesito análisis estadístico completo de datos de ventas para mi tesis.",
      subject: "Estadística",
      studyArea: "Estadística",
      budget: "120.00",
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      attachments: ["datos_ventas.xlsx"],
      status: "active",
      candidateCount: 1
    }).returning();

    // Create candidates
    await db.insert(candidates).values({
      taskId: task1.id,
      tutorId: tutor1.id,
      message: "Tengo amplia experiencia en cálculo diferencial. Puedo ayudarte con ejercicios paso a paso y preparación para el examen.",
      proposedPrice: "75.00"
    });

    await db.insert(candidates).values({
      taskId: task1.id,
      tutorId: tutor2.id,
      message: "Como ingeniera, tengo sólidos fundamentos en matemáticas. Te ayudo con métodos prácticos de resolución.",
      proposedPrice: "80.00"
    });

    await db.insert(candidates).values({
      taskId: task2.id,
      tutorId: tutor2.id,
      message: "Especialista en AutoCAD y diseño estructural. Te entrego el proyecto completo con planos detallados.",
      proposedPrice: "140.00"
    });

    await db.insert(candidates).values({
      taskId: task3.id,
      tutorId: tutor1.id,
      message: "Experto en análisis estadístico con software especializado. Incluyo interpretación de resultados.",
      proposedPrice: "110.00"
    });

    // Create system IDs for tracking
    await db.insert(systemIds).values([
      {
        entityType: "user",
        entityId: student1.id,
        systemCode: "USR-0001",
        displayName: student1.name,
        status: "active"
      },
      {
        entityType: "user", 
        entityId: tutor1.id,
        systemCode: "USR-0002",
        displayName: tutor1.name,
        status: "active"
      },
      {
        entityType: "user",
        entityId: tutor2.id,
        systemCode: "USR-0003", 
        displayName: tutor2.name,
        status: "active"
      },
      {
        entityType: "user",
        entityId: student2.id,
        systemCode: "USR-0004",
        displayName: student2.name,
        status: "active"
      },
      {
        entityType: "task",
        entityId: task1.id,
        systemCode: "TSK-0001",
        displayName: task1.title,
        status: "active"
      },
      {
        entityType: "task",
        entityId: task2.id,
        systemCode: "TSK-0002",
        displayName: task2.title,
        status: "active"
      },
      {
        entityType: "task",
        entityId: task3.id,
        systemCode: "TSK-0003",
        displayName: task3.title,
        status: "active"
      },
      {
        entityType: "tutor",
        entityId: tutorProfile1.id,
        systemCode: "TUT-0001",
        displayName: `Tutor ${tutor1.name}`,
        status: "active"
      },
      {
        entityType: "tutor",
        entityId: tutorProfile2.id,
        systemCode: "TUT-0002", 
        displayName: `Tutor ${tutor2.name}`,
        status: "active"
      }
    ]);

    // Create some sample reviews
    await db.insert(reviews).values([
      {
        taskId: task1.id,
        tutorId: tutorProfile1.id,
        studentId: student1.id,
        rating: 5,
        comment: "Excelente explicación, muy claro y paciente. Logré entender todos los conceptos."
      },
      {
        taskId: task2.id,
        tutorId: tutorProfile2.id,
        studentId: student1.id,
        rating: 5,
        comment: "Trabajo impecable en AutoCAD. Los planos quedaron perfectos y a tiempo."
      }
    ]);

    // Create sample chat messages
    await db.insert(chatMessages).values([
      {
        taskId: task1.id,
        senderId: student1.id,
        receiverId: tutor1.id,
        message: "Hola Dr. Rodriguez, ¿podrías ayudarme con estos ejercicios de límites?",
        attachments: null
      },
      {
        taskId: task1.id,
        senderId: tutor1.id,
        receiverId: student1.id,
        message: "¡Por supuesto! He revisado tus ejercicios. Comencemos con el primer problema...",
        attachments: null
      },
      {
        taskId: task2.id,
        senderId: student1.id,
        receiverId: tutor2.id,
        message: "Ana, aquí están los planos base para el proyecto de estructura.",
        attachments: ["planos_base.dwg"]
      },
      {
        taskId: task2.id,
        senderId: tutor2.id,
        receiverId: student1.id,
        message: "Perfecto, ya los revisé. Comenzaré con el diseño estructural esta semana.",
        attachments: null
      }
    ]);

    // Create chat rooms
    await db.insert(chatRooms).values([
      {
        taskId: task1.id,
        studentId: student1.id,
        tutorId: tutor1.id,
        lastMessage: "¡Por supuesto! He revisado tus ejercicios. Comencemos con el primer problema...",
        lastMessageAt: new Date()
      },
      {
        taskId: task2.id,
        studentId: student1.id,
        tutorId: tutor2.id,
        lastMessage: "Perfecto, ya los revisé. Comenzaré con el diseño estructural esta semana.",
        lastMessageAt: new Date()
      }
    ]);

    // Create careers
    const mathSpecialty = await db.insert(careers).values({
      name: "Cálculo Diferencial",
      category: "Matemáticas",
      description: "Límites, derivadas, aplicaciones del cálculo diferencial",
      isActive: true,
      tutorCount: 0
    }).returning();

    const physicsSpecialty = await db.insert(careers).values({
      name: "Física Mecánica", 
      category: "Física",
      description: "Cinemática, dinámica, estática y mecánica de fluidos",
      isActive: true,
      tutorCount: 0
    }).returning();

    const autocadSpecialty = await db.insert(careers).values({
      name: "AutoCAD 2D/3D",
      category: "Ingeniería", 
      description: "Diseño asistido por computadora, planos técnicos",
      isActive: true,
      tutorCount: 0
    }).returning();

    const structuresSpecialty = await db.insert(careers).values({
      name: "Análisis Estructural",
      category: "Ingeniería Civil",
      description: "Diseño de estructuras, análisis de cargas",
      isActive: true,
      tutorCount: 0
    }).returning();

    const statisticsSpecialty = await db.insert(careers).values({
      name: "Estadística Descriptiva",
      category: "Estadística",
      description: "Análisis de datos, medidas de tendencia central",
      isActive: true,
      tutorCount: 0
    }).returning();

    const programmingSpecialty = await db.insert(careers).values({
      name: "Programación Python",
      category: "Programación",
      description: "Fundamentos de programación, algoritmos, estructuras de datos",
      isActive: true,
      tutorCount: 0
    }).returning();

    // Assign careers to tutors
    await db.insert(tutorCareers).values([
      {
        tutorId: tutorProfile1.id,
        specialtyId: mathSpecialty[0].id,
        experienceLevel: "expert",
        yearsExperience: 15,
        isVerified: true
      },
      {
        tutorId: tutorProfile1.id,
        specialtyId: physicsSpecialty[0].id,
        experienceLevel: "expert", 
        yearsExperience: 15,
        isVerified: true
      },
      {
        tutorId: tutorProfile1.id,
        specialtyId: statisticsSpecialty[0].id,
        experienceLevel: "advanced",
        yearsExperience: 10,
        isVerified: true
      },
      {
        tutorId: tutorProfile2.id,
        specialtyId: autocadSpecialty[0].id,
        experienceLevel: "expert",
        yearsExperience: 12,
        isVerified: true
      },
      {
        tutorId: tutorProfile2.id,
        specialtyId: structuresSpecialty[0].id,
        experienceLevel: "expert",
        yearsExperience: 12,
        isVerified: true
      },
      {
        tutorId: tutorProfile2.id,
        specialtyId: programmingSpecialty[0].id,
        experienceLevel: "intermediate",
        yearsExperience: 5,
        isVerified: false
      }
    ]);

    // Update career tutor counts
    await db.update(careers).set({ tutorCount: 1 }).where(eq(careers.id, mathSpecialty[0].id));
    await db.update(careers).set({ tutorCount: 1 }).where(eq(careers.id, physicsSpecialty[0].id));
    await db.update(careers).set({ tutorCount: 1 }).where(eq(careers.id, autocadSpecialty[0].id));
    await db.update(careers).set({ tutorCount: 1 }).where(eq(careers.id, structuresSpecialty[0].id));
    await db.update(careers).set({ tutorCount: 1 }).where(eq(careers.id, statisticsSpecialty[0].id));
    await db.update(careers).set({ tutorCount: 1 }).where(eq(careers.id, programmingSpecialty[0].id));

    // Create tutor certifications
    await db.insert(tutorCertifications).values([
      {
        tutorId: tutorProfile1.id,
        title: "Doctor en Física",
        institution: "Universidad Nacional Mayor de San Marcos",
        issueDate: new Date('2010-12-15'),
        credentialId: "DOC-FIS-2010-001",
        isVerified: true,
        verifiedBy: student1.id, // Admin user
        verifiedAt: new Date()
      },
      {
        tutorId: tutorProfile1.id,
        title: "Maestría en Matemáticas Aplicadas",
        institution: "Universidad de Lima",
        issueDate: new Date('2008-07-20'),
        credentialId: "MAE-MAT-2008-045",
        isVerified: true,
        verifiedBy: student1.id,
        verifiedAt: new Date()
      },
      {
        tutorId: tutorProfile2.id,
        title: "Ingeniera Civil",
        institution: "Pontificia Universidad Católica del Perú",
        issueDate: new Date('2012-03-10'),
        credentialId: "ING-CIV-2012-089",
        isVerified: true,
        verifiedBy: student1.id,
        verifiedAt: new Date()
      },
      {
        tutorId: tutorProfile2.id,
        title: "Certificación AutoCAD Professional",
        institution: "Autodesk",
        issueDate: new Date('2015-09-05'),
        expiryDate: new Date('2025-09-05'),
        credentialId: "ACAD-PRO-2015-567",
        verificationUrl: "https://www.autodesk.com/verify/567",
        isVerified: true,
        verifiedBy: student1.id,
        verifiedAt: new Date()
      }
    ]);

    console.log("✅ Database seeded successfully!");
    console.log(`Created ${6} users (including ALUMNO1 & ALUMNO2), ${3} tasks, ${4} candidates, ${3} tutors, ${2} reviews`);
    console.log(`Generated ${9} system IDs for tracking`);
    console.log(`Created ${6} specialties and ${6} tutor specialty assignments`);
    console.log(`Added ${4} tutor certifications`);
    console.log(`🎓 Demo accounts: al1@miltareas.com / al2@miltareas.com (password: 123456)`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}