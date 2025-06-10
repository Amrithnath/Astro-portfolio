// Resume Compendium - Modular Resume Data Management System
export interface ContactInfo {
  name: string;
  title: string;
  email: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  twitter?: string;
  portfolio?: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  position: string;
  location?: string;
  startDate: string;
  endDate?: string; // null for current position
  description: string;
  achievements: string[];
  technologies?: string[];
  type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
  industry?: string;
  companySize?: string;
  isRemote?: boolean;
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
  honors?: string[];
  coursework?: string[];
  location?: string;
  thesis?: string;
  activities?: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  technologies: string[];
  role: string;
  startDate: string;
  endDate?: string;
  url?: string;
  github?: string;
  demo?: string;
  type: 'personal' | 'professional' | 'academic' | 'open-source';
  status: 'completed' | 'in-progress' | 'maintenance';
  highlights: string[];
  teamSize?: number;
}

export interface SkillCategory {
  category: string;
  skills: SkillItem[];
  priority: number; // for ordering
}

export interface SkillItem {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience?: number;
  lastUsed?: string;
  certified?: boolean;
  endorsements?: number;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  url?: string;
  skills?: string[];
}

export interface AwardItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  description: string;
  type: 'academic' | 'professional' | 'competition' | 'recognition';
}

export interface VolunteerItem {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate?: string;
  description: string;
  achievements: string[];
  skills?: string[];
}

export interface PublicationItem {
  id: string;
  title: string;
  type: 'article' | 'paper' | 'book' | 'blog' | 'presentation';
  publisher?: string;
  date: string;
  url?: string;
  description: string;
  coAuthors?: string[];
}

export interface LanguageItem {
  language: string;
  proficiency: 'native' | 'fluent' | 'conversational' | 'basic' | 'professional';
  certification?: string;
}

export interface CustomSection {
  id: string;
  title: string;
  type: 'list' | 'paragraph' | 'table' | 'custom';
  content: any;
  priority: number;
}

export interface ResumeSettings {
  theme: 'modern' | 'classic' | 'minimal' | 'creative';
  colorScheme: 'blue' | 'green' | 'red' | 'purple' | 'black' | 'custom';
  layout: 'single-column' | 'two-column' | 'sidebar';
  fontSize: 'small' | 'medium' | 'large';
  pageMargins: 'narrow' | 'normal' | 'wide';
  includePhoto: boolean;
  photoUrl?: string;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[]; // section IDs to include
  sectionOrder: string[];
  settings: ResumeSettings;
}

export interface ResumeCompendium {
  // Personal Information
  contact: ContactInfo;
  summary: string;
  
  // Main Sections
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  skills: SkillCategory[];
  
  // Additional Sections
  certifications: CertificationItem[];
  awards: AwardItem[];
  volunteer: VolunteerItem[];
  publications: PublicationItem[];
  languages: LanguageItem[];
  customSections: CustomSection[];
  
  // Templates and Settings
  templates: ResumeTemplate[];
  defaultTemplate: string;
  
  // Metadata
  lastUpdated: string;
  version: string;
}

// Default resume compendium with real data
export const resumeCompendium: ResumeCompendium = {
  contact: {
    name: "Amrithnath Vijayakumar",
    title: "Product Development Engineer III | Solutions Engineer",
    email: "hello@amrithnath.dev",
    phone: "+91 8147842231",
    location: "Bangalore, India",
    website: "amrithnath.dev",
    linkedin: "linkedin.com/in/amrithnath",
    github: "github.com/Amrithnath",
    twitter: "x.com/arjunamrith",
    portfolio: "amrithnath.dev"
  },
  
  summary: "Versatile Solutions Engineer with 6+ years of experience architecting and delivering complex IT solutions. Expert in Python scripting and cloud-native architectures, with a proven track record of client-facing technical leadership, rapid prototyping, and driving business outcomes. Passionate about integrating open-source technologies, building scalable distributed systems, and enabling innovative AI-powered applications. Strong background in API integration and API development.",
  
  experience: [
    {
      id: "exp1",
      company: "Phenom People Pvt Ltd (previously Tydy)",
      position: "Product Development Engineer III",
      location: "Bangalore, India",
      startDate: "2018-10",
      endDate: null,
      description: "Led technical solution design and development for 11+ enterprise projects, directly contributing to $900K gross recurring revenue and 20% YoY revenue growth",
      achievements: [
        "Led technical solution design and development for 11+ enterprise projects, directly contributing to $900K gross recurring revenue and 20% YoY revenue growth",
        "Delivered technical demos and proof-of-concepts that resulted in 8+ new product features and multiple client conversions",
        "Architected and migrated core SaaS platforms from monolith to microservices, improving scalability and performance by 10%",
        "Designed and implemented business-critical modules (authentication, notifications, BGV) and integrated third-party tools (e-sign, SMS) to expand product capabilities",
        "Drove DevOps improvements, halving deployment times and reducing post-deployment bugs by 25%",
        "Mentored a team of 3 engineers, focusing on rapid prototyping and client-specific solutioning",
        "Regularly collaborated with sales, product, and customer success teams to scope, deliver, and transition technical solutions for enterprise clients",
        "Working on migrating existing Tydy clients as part of Phenom acquisition process, with KPIs of increasing revenue by 20% from existing clients"
      ],
      technologies: ["JavaScript", "TypeScript", "Node.js", "Python", "AWS", "Docker", "Jenkins", "MySQL", "PostgreSQL", "MongoDB", "Redis"],
      type: "full-time",
      industry: "SaaS/HR Tech",
      companySize: "1000-2000",
      isRemote: false
    }
  ],
  
  education: [
    {
      id: "edu1",
      institution: "New Horizon College of Engineering",
      degree: "Bachelor's",
      field: "Electronics and Communication Engineering",
      startDate: "2014-08",
      endDate: "2018-05",
      location: "Bangalore, India",
      activities: [
        "Project Trainee at ISRO - Weather prediction model using K-means clustering and Linear Regression (60% accuracy improvement)",
        "Co-Organizer of TEDX NHCE 2018",
        "Core Team member for National level cultural fest Sargam (2017, 2018)",
        "2nd place at national level project exhibition tech horizon"
      ]
    }
  ],
  
  projects: [
    {
      id: "proj1",
      name: "Personal Website",
      description: "Fast and optimized personal portfolio website built with Astro framework",
      longDescription: "Developed using Astro framework to create a fast and well optimized website with automated deployment pipeline and mail server setup.",
      technologies: ["Astro", "TypeScript", "CSS", "Cloudflare", "GitHub Actions"],
      role: "Full-Stack Developer",
      startDate: "2020-01",
      endDate: null,
      url: "https://amrithnath.dev",
      github: "https://github.com/Amrithnath",
      type: "personal",
      status: "in-progress",
      highlights: [
        "Achieved 90% Lighthouse score with 100% best practices",
        "Automated deployment to multiple platforms (Cloudflare, GitHub, GCP, home lab)",
        "Custom mail server with DMARC, SPF rules",
        "Zero cost hosting (excluding domain renewal)",
        "Technical blogs and project documentation"
      ],
      teamSize: 1
    },
    {
      id: "proj2",
      name: "Raspberry Pi Weather Station & ML Prediction",
      description: "IoT weather station with machine learning prediction capabilities",
      longDescription: "Designed and built a weather station using Raspberry Pi and sensors, with automated data collection and ML-based weather prediction using 10+ years of historical data.",
      technologies: ["Raspberry Pi", "Arduino", "Python", "DynamoDB", "Machine Learning", "DHT11", "BMP180"],
      role: "Hardware & Software Engineer",
      startDate: "2017-01",
      endDate: "2018-12",
      type: "academic",
      status: "completed",
      highlights: [
        "Real-time weather data collection using sensor array",
        "Automated data ingestion to DynamoDB",
        "ML model for next-day weather prediction",
        "Processed 10+ years of historical weather data",
        "Visualization dashboards for data analysis"
      ],
      teamSize: 1
    },
    {
      id: "proj3",
      name: "Home Lab & Home Automation",
      description: "Multi-server home lab with IoT device orchestration",
      longDescription: "Built a comprehensive home server cluster for prototyping, development, and smart home automation, eliminating reliance on third-party cloud services.",
      technologies: ["Raspberry Pi", "Docker", "Reverse Proxy", "Load Balancer", "IoT", "Terraform"],
      role: "Systems Engineer",
      startDate: "2016-01",
      endDate: null,
      type: "personal",
      status: "in-progress",
      highlights: [
        "4 Raspberry Pi cluster for load balancing and prototyping",
        "Integrated all home IoT devices locally",
        "Reverse proxy and internal load balancer",
        "Working on NAS server for data backup",
        "Terraform scripts for local cloud testing"
      ],
      teamSize: 1
    },
    {
      id: "proj4",
      name: "Serverless URL Shortener",
      description: "Production-grade serverless URL shortening service",
      longDescription: "Created a scalable serverless web application using AWS services for URL shortening, currently used in production at Tydy.",
      technologies: ["AWS Lambda", "DynamoDB", "API Gateway", "REST APIs"],
      role: "Full-Stack Developer",
      startDate: "2019-10",
      endDate: "2019-10",
      type: "professional",
      status: "completed",
      highlights: [
        "Serverless architecture for cost efficiency",
        "REST API endpoints for public access",
        "Production deployment at Tydy",
        "Scalable and reliable URL shortening"
      ],
      teamSize: 1
    },
    {
      id: "proj5",
      name: "Autonomous Agricultural Rover",
      description: "AI-powered autonomous rover for farm management",
      longDescription: "Developed an agricultural rover using computer vision, machine learning, and reinforcement learning for autonomous navigation and farm management tasks.",
      technologies: ["OpenCV", "Machine Learning", "Reinforcement Learning", "Python", "Computer Vision"],
      role: "ML Engineer",
      startDate: "2015-08",
      endDate: "2016-05",
      type: "academic",
      status: "completed",
      highlights: [
        "Computer vision for navigation and obstacle detection",
        "Reinforcement learning for efficient path planning",
        "Sensor fusion for autonomous operation",
        "Agricultural application focus"
      ],
      teamSize: 2
    }
  ],
  
  skills: [
    {
      category: "Programming Languages",
      priority: 1,
      skills: [
        { name: "JavaScript", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" },
        { name: "TypeScript", level: "expert", yearsOfExperience: 5, lastUsed: "2024-01" },
        { name: "Node.js", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" },
        { name: "Python", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" },
        { name: "Java", level: "intermediate", yearsOfExperience: 3, lastUsed: "2023-06" },
        { name: "PHP", level: "intermediate", yearsOfExperience: 2, lastUsed: "2022-12" },
        { name: "Go", level: "beginner", yearsOfExperience: 1, lastUsed: "2023-09" },
        { name: "Zig", level: "beginner", yearsOfExperience: 1, lastUsed: "2023-08" }
      ]
    },
    {
      category: "Web Technologies",
      priority: 2,
      skills: [
        { name: "Angular", level: "advanced", yearsOfExperience: 4, lastUsed: "2024-01" },
        { name: "REST APIs", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" },
        { name: "gRPC", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-11" },
        { name: "WebSockets", level: "advanced", yearsOfExperience: 3, lastUsed: "2023-12" },
        { name: "HTML", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" },
        { name: "CSS", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" },
        { name: "Apache Web Server", level: "advanced", yearsOfExperience: 4, lastUsed: "2023-10" }
      ]
    },
    {
      category: "Cloud & Serverless",
      priority: 3,
      skills: [
        { name: "AWS", level: "expert", yearsOfExperience: 5, lastUsed: "2024-01", certified: true },
        { name: "AWS Lambda", level: "expert", yearsOfExperience: 4, lastUsed: "2024-01" },
        { name: "Google Cloud Platform", level: "advanced", yearsOfExperience: 3, lastUsed: "2023-11", certified: true },
        { name: "Cloudflare Workers", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-12" },
        { name: "Google Cloud Functions", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-09" }
      ]
    },
    {
      category: "Databases",
      priority: 4,
      skills: [
        { name: "MySQL", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" },
        { name: "PostgreSQL", level: "advanced", yearsOfExperience: 4, lastUsed: "2024-01" },
        { name: "MongoDB", level: "advanced", yearsOfExperience: 4, lastUsed: "2023-12" },
        { name: "Neo4j", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-08" },
        { name: "Redis", level: "advanced", yearsOfExperience: 3, lastUsed: "2024-01" },
        { name: "DynamoDB", level: "advanced", yearsOfExperience: 3, lastUsed: "2023-11" },
        { name: "Google BigQuery", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-10" },
        { name: "AWS Athena", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-09" }
      ]
    },
    {
      category: "DevOps",
      priority: 5,
      skills: [
        { name: "Docker", level: "expert", yearsOfExperience: 5, lastUsed: "2024-01" },
        { name: "Jenkins", level: "advanced", yearsOfExperience: 4, lastUsed: "2024-01" },
        { name: "GitHub Actions", level: "advanced", yearsOfExperience: 3, lastUsed: "2024-01" },
        { name: "Terraform", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-11" },
        { name: "Kubernetes", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-10" },
        { name: "Linux Server", level: "expert", yearsOfExperience: 6, lastUsed: "2024-01" }
      ]
    },
    {
      category: "IoT & Hardware",
      priority: 6,
      skills: [
        { name: "Raspberry Pi", level: "expert", yearsOfExperience: 8, lastUsed: "2024-01" },
        { name: "Arduino", level: "advanced", yearsOfExperience: 6, lastUsed: "2023-12" },
        { name: "ESP32", level: "advanced", yearsOfExperience: 4, lastUsed: "2023-11" },
        { name: "Sensors", level: "advanced", yearsOfExperience: 6, lastUsed: "2023-12" }
      ]
    },
    {
      category: "Monitoring & Security",
      priority: 7,
      skills: [
        { name: "Grafana", level: "advanced", yearsOfExperience: 3, lastUsed: "2024-01" },
        { name: "New Relic", level: "advanced", yearsOfExperience: 3, lastUsed: "2024-01" },
        { name: "SonarQube", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-12" },
        { name: "OWASP ZAP", level: "intermediate", yearsOfExperience: 2, lastUsed: "2023-11" }
      ]
    }
  ],
  
  certifications: [
    {
      id: "cert1",
      name: "ISC2 CC (Cybersecurity)",
      issuer: "ISC2",
      issueDate: "2024-04",
      expiryDate: "2027-04",
      skills: ["Cybersecurity", "Risk Management", "Security Controls"]
    },
    {
      id: "cert2",
      name: "From Data to Insights with Google Cloud",
      issuer: "Google Cloud",
      issueDate: "2019-07",
      skills: ["Google Cloud Platform", "BigQuery", "Data Analytics", "ML"]
    }
  ],
  
  awards: [
    {
      id: "award1",
      name: "Employee of the Year",
      issuer: "Tydy",
      date: "2022-12",
      description: "Recognized for outstanding contributions to product development and client success",
      type: "professional"
    },
    {
      id: "award2",
      name: "Employee of the Quarter",
      issuer: "Tydy",
      date: "2023-03",
      description: "Q1 2023 recognition for exceptional performance and leadership",
      type: "professional"
    },
    {
      id: "award3",
      name: "Employee of the Quarter",
      issuer: "Tydy", 
      date: "2021-09",
      description: "Q3 2021 recognition for technical excellence and project delivery",
      type: "professional"
    },
    {
      id: "award4",
      name: "2nd Place - National Level Project Exhibition",
      issuer: "Tech Horizon",
      date: "2018-03",
      description: "Weather prediction model using machine learning achieved 2nd place at national tech conference",
      type: "academic"
    }
  ],
  
  volunteer: [
    {
      id: "vol1",
      organization: "TEDX NHCE",
      role: "Co-Organizer",
      startDate: "2017-08",
      endDate: "2018-05",
      description: "Co-organized TEDx event at New Horizon College of Engineering",
      achievements: [
        "Successfully coordinated TEDx event with 500+ attendees",
        "Managed speaker coordination and event logistics",
        "Led team of 15+ volunteers"
      ],
      skills: ["Event Management", "Leadership", "Public Speaking"]
    },
    {
      id: "vol2",
      organization: "Sargam Cultural Fest",
      role: "Core Team Member",
      startDate: "2016-08",
      endDate: "2018-05",
      description: "Core team member for national level cultural fest at NHCE",
      achievements: [
        "Organized national level cultural festival for 2 consecutive years",
        "Coordinated with multiple colleges across India",
        "Managed technical and cultural event logistics"
      ],
      skills: ["Event Management", "Coordination", "Team Leadership"]
    }
  ],
  
  publications: [],
  
  languages: [
    { language: "English", proficiency: "native" },
    { language: "Hindi", proficiency: "professional" },
    { language: "Kannada", proficiency: "professional" },
    { language: "Tamil", proficiency: "native" }
  ],
  
  customSections: [
    {
      id: "interests",
      title: "Interests",
      type: "list",
      content: ["Photography", "Gaming", "Travel", "Open Source Contributing"],
      priority: 10
    }
  ],
  
  templates: [
    {
      id: "standard",
      name: "Standard Professional",
      description: "Classic resume format suitable for most positions",
      sections: ["contact", "summary", "experience", "education", "skills"],
      sectionOrder: ["contact", "summary", "experience", "education", "skills"],
      settings: {
        theme: "classic",
        colorScheme: "blue",
        layout: "single-column",
        fontSize: "medium",
        pageMargins: "normal",
        includePhoto: false
      }
    },
    {
      id: "technical",
      name: "Technical Focus",
      description: "Emphasizes technical skills and projects",
      sections: ["contact", "summary", "skills", "experience", "projects", "education"],
      sectionOrder: ["contact", "summary", "skills", "experience", "projects", "education"],
      settings: {
        theme: "modern",
        colorScheme: "green",
        layout: "two-column",
        fontSize: "medium",
        pageMargins: "normal",
        includePhoto: false
      }
    },
    {
      id: "comprehensive",
      name: "Comprehensive",
      description: "Includes all available sections",
      sections: ["contact", "summary", "experience", "education", "skills", "projects", "certifications", "awards", "volunteer", "publications", "languages"],
      sectionOrder: ["contact", "summary", "experience", "education", "skills", "projects", "certifications", "awards", "volunteer", "publications", "languages"],
      settings: {
        theme: "minimal",
        colorScheme: "black",
        layout: "single-column",
        fontSize: "small",
        pageMargins: "narrow",
        includePhoto: true
      }
    }
  ],
  
  defaultTemplate: "standard",
  lastUpdated: "2024-12-15",
  version: "1.0.0"
};