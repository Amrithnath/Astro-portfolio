// Portfolio Data Configuration
export interface PortfolioData {
  personal: {
    name: string;
    title: string;
    subtitle: string;
    description: string;
    roles: string[];
  };
  contact: {
    email: string;
    github: string;
    linkedin: string;
    twitter?: string;
    instagram?: string;
  };
  skills: {
    [category: string]: string[];
  };
  bio: {
    short: string;
    long: string;
  };
}

export const portfolioData: PortfolioData = {
  personal: {
    name: "Amrithnath Vijayakumar",
    title: "Amrithnath V",
    subtitle: "The one and only site for",
    description: "Lover of dogs, cats, roadtrips, and planes.",
    roles: ["💻 Developer", "🎮 Gamer", "📸 Photographer"]
  },
  contact: {
    email: "hello@amrithnath.com",
    github: "github.com/amrithnath",
    linkedin: "linkedin.com/in/amrithnath",
    twitter: "x.com/arjunamrith",
    instagram: "instagram.com/arjunamrith"
  },
  skills: {
    "Frontend": [
      "React", 
      "Next.js", 
      "TypeScript", 
      "Astro", 
      "Vue.js",
      "HTML/CSS"
    ],
    "Backend": [
      "Node.js", 
      "Python", 
      "Django", 
      "Express",
      "FastAPI"
    ],
    "Database": [
      "PostgreSQL", 
      "MongoDB", 
      "Redis",
      "SQLite"
    ],
    "DevOps & Tools": [
      "Docker", 
      "AWS", 
      "CI/CD",
      "Git",
      "Vercel"
    ]
  },
  bio: {
    short: "Full-stack developer, gamer, and photographer passionate about creating clean, efficient code and beautiful user experiences.",
    long: "Hello! I'm Amrith, and this is my website. It was made using Astro, a new way to build static sites. Astro was extremely easy to use, I built all this under 10mins."
  }
};

// Terminal-specific commands and outputs
export const terminalCommands = {
  whoami: {
    command: "whoami",
    output: `
╔═══════════════════════════════════════╗
║          AMRITHNATH VIJAYAKUMAR       ║
║     Full-Stack Developer & Creator    ║
╚═══════════════════════════════════════╝`
  },
  about: {
    command: "cat about.json",
    output: (data: PortfolioData) => ({
      name: data.personal.name,
      role: "Full-Stack Developer",
      description: data.bio.short,
      interests: data.personal.roles,
      status: "Available for new opportunities"
    })
  },
  skills: {
    command: "ls -la skills/",
    output: (data: PortfolioData) => 
      Object.entries(data.skills).flatMap(([category, skills]) => 
        skills.map(skill => `→ ${skill}`)
      )
  },
  navigation: {
    command: "ls navigation/",
    output: [
      "📁 about/",
      "📁 projects/", 
      "📄 resume.pdf",
      "📁 blog/",
      "📧 contact.txt"
    ]
  },
  contact: {
    command: "cat contact.json",
    output: (data: PortfolioData) => ({
      email: data.contact.email,
      github: data.contact.github,
      linkedin: data.contact.linkedin,
      website: "amrithnath.com"
    })
  }
}; 