exports.getPortfolio = async (req, res) => {
  try {
    const portfolioData = {
      personalInfo: {
        name: 'Chala Birmechu',
        title: 'Full Stack & Mobile Developer',
        location: 'Addis Ababa, Ethiopia',
        email: 'chalabirmechu@gmail.com',
        phone: ['+251915950217', '+251941274261'],
        bio: 'I am a passionate software engineer specializing in full-stack web and mobile development...',
        experience: '2+',
        projects: '5+',
        clients: '3+',
        satisfaction: '100%',
      },
      skills: {
        frontend: ['React', 'Vue', 'HTML5', 'CSS3', 'JavaScript', 'TailwindCSS'],
        backend: ['Node.js', 'Express', 'Django', 'Spring Boot', 'Flask'],
        mobile: ['Flutter', 'React Native', 'Android', 'iOS'],
        devops: ['Git', 'Docker', 'AWS', 'Heroku', 'CI/CD'],
      },
    };
    res.json(portfolioData);
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
};
