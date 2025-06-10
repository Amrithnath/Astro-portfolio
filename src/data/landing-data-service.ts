// Landing Page Data Service - Dynamic data generation with randomness
import { resumeCompendium, type ResumeCompendium, type ExperienceItem, type ProjectItem, type SkillCategory } from './resume-compendium';

// Utility function to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Utility function to get random items from array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

// Utility function to get random description variants
function getRandomDescription(): string {
  const descriptions = [
    resumeCompendium.summary,
    "Versatile Solutions Engineer passionate about building scalable systems and delivering innovative solutions",
    "Full-stack developer with expertise in cloud architectures and API development",
    "Product Development Engineer focused on client-facing technical leadership and rapid prototyping",
    "Solutions architect with a passion for open-source technologies and distributed systems"
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

// Generate random professional roles/titles
function getRandomRole(): string {
  const roles = [
    resumeCompendium.contact.title,
    "Full-Stack Developer",
    "Solutions Engineer", 
    "Product Development Engineer",
    "Cloud Architect",
    "API Specialist"
  ];
  return roles[Math.floor(Math.random() * roles.length)];
}

// Generate random tech stack for terminal view
function getRandomTechStack(): { [category: string]: string[] } {
  const allSkills = resumeCompendium.skills.reduce((acc, category) => {
    acc[category.category] = shuffleArray(category.skills.map(skill => skill.name));
    return acc;
  }, {} as { [key: string]: string[] });

  // Randomly select 3-5 categories
  const categories = Object.keys(allSkills);
  const selectedCategories = getRandomItems(categories, Math.floor(Math.random() * 3) + 3);
  
  const techStack: { [category: string]: string[] } = {};
  selectedCategories.forEach(category => {
    // Get 3-6 random skills from each category
    const skillCount = Math.floor(Math.random() * 4) + 3;
    techStack[category] = getRandomItems(allSkills[category], skillCount);
  });
  
  return techStack;
}

// Generate random interests/hobbies
function getRandomInterests(): string[] {
  const baseInterests = resumeCompendium.customSections
    .find(section => section.id === 'interests')?.content || [];
  
  const additionalInterests = [
    "🤖 AI/ML", "🌐 Web3", "📱 Mobile Dev", "☁️ Cloud Computing", 
    "🔒 Cybersecurity", "🎵 Music", "🏃‍♂️ Running", "📚 Reading",
    "🎨 Design", "🚀 Space Tech", "🧠 Problem Solving", "🔬 Research"
  ];
  
  const allInterests = [...baseInterests, ...additionalInterests];
  return getRandomItems(allInterests, Math.floor(Math.random() * 3) + 4);
}

// Generate random achievements
function getRandomAchievements(): string[] {
  const allAchievements = resumeCompendium.experience.flatMap(exp => exp.achievements);
  return getRandomItems(allAchievements, Math.floor(Math.random() * 3) + 2);
}

// Generate random contact info variants
function getRandomContactVariants() {
  const variants = {
    email: [
      resumeCompendium.contact.email,
      "hey@amrithnath.dev",
      "hello@amrithnath.dev"
    ],
    github: [
      resumeCompendium.contact.github,
      "github.com/Amrithnath",
      "github.com/amrithnath"
    ],
    linkedin: [
      resumeCompendium.contact.linkedin,
      "linkedin.com/in/amrithnath",
      "linkedin.com/in/amrithnath-v"
    ]
  };
  
  return {
    email: variants.email[Math.floor(Math.random() * variants.email.length)],
    github: variants.github[Math.floor(Math.random() * variants.github.length)],
    linkedin: variants.linkedin[Math.floor(Math.random() * variants.linkedin.length)]
  };
}

// Generate random project highlights
function getRandomProjectHighlights(): ProjectItem[] {
  return getRandomItems(resumeCompendium.projects, Math.floor(Math.random() * 2) + 3);
}

// Generate random skills for different views
function getRandomSkillsForView(viewType: 'terminal' | 'professional' | 'personal'): string[] {
  const allSkills = resumeCompendium.skills.flatMap(category => 
    category.skills.map(skill => skill.name)
  );
  
  const skillCount = viewType === 'terminal' ? 8 : viewType === 'professional' ? 6 : 5;
  return getRandomItems(allSkills, skillCount);
}

// Main function to generate dynamic landing page data
export function generateDynamicLandingData() {
  const contactVariants = getRandomContactVariants();
  const randomTechStack = getRandomTechStack();
  const randomProjects = getRandomProjectHighlights();
  
  return {
    // Basic info with some randomness
    name: resumeCompendium.contact.name,
    title: getRandomRole(),
    description: getRandomDescription(),
    location: resumeCompendium.contact.location,
    
    // Contact info with variants
    contact: {
      email: contactVariants.email,
      github: contactVariants.github,
      linkedin: contactVariants.linkedin,
      website: resumeCompendium.contact.website,
      phone: resumeCompendium.contact.phone
    },
    
    // Dynamic skills and tech stack
    skills: getRandomSkillsForView('professional'),
    techStack: randomTechStack,
    
    // Random projects and achievements
    projects: randomProjects,
    achievements: getRandomAchievements(),
    interests: getRandomInterests(),
    
    // Experience highlights
    currentRole: resumeCompendium.experience[0],
    yearsOfExperience: new Date().getFullYear() - 2018, // Started in 2018
    
    // Random stats
    stats: {
      projectsCompleted: Math.floor(Math.random() * 5) + resumeCompendium.projects.length,
      technologiesUsed: resumeCompendium.skills.reduce((total, cat) => total + cat.skills.length, 0),
      yearsOfExperience: new Date().getFullYear() - 2018,
      certifications: resumeCompendium.certifications.length,
      awards: resumeCompendium.awards.length
    },
    
    // Theme-specific data
    terminal: {
      recentCommands: shuffleArray([
        'cat about.json',
        'ls -la projects/',
        'tree skills/',
        'grep -r "innovation" .',
        'git log --oneline',
        'docker ps',
        'npm run dev',
        'python main.py'
      ]).slice(0, 3),
      systemInfo: {
        uptime: `${Math.floor(Math.random() * 365) + 200} days`,
        load: `${(Math.random() * 2).toFixed(2)} ${(Math.random() * 2).toFixed(2)} ${(Math.random() * 2).toFixed(2)}`,
        processes: Math.floor(Math.random() * 50) + 150
      }
    }
  };
}

// Export type for the dynamic data
export type DynamicLandingData = ReturnType<typeof generateDynamicLandingData>;

// Function to get seeded randomness (for consistency during SSR)
export function generateSeededLandingData(seed?: string): DynamicLandingData {
  // Simple seeded random function
  let seedValue = 0;
  if (seed) {
    for (let i = 0; i < seed.length; i++) {
      seedValue += seed.charCodeAt(i);
    }
  } else {
    seedValue = Date.now() % 10000; // Changes every ~3 hours
  }
  
  // Use seeded random instead of Math.random for consistency
  const seededRandom = (function(seed: number) {
    let state = seed;
    return function() {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  })(seedValue);
  
  // Override Math.random temporarily
  const originalRandom = Math.random;
  Math.random = seededRandom;
  
  const data = generateDynamicLandingData();
  
  // Restore original Math.random
  Math.random = originalRandom;
  
  return data;
} 