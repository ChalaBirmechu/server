const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    personalInfo: {
      name: 'Chala Birmechu',
      title: 'Full Stack & Mobile Developer',
      location: 'Addis Ababa, Ethiopia',
      email: 'chalabirmechu@gmail.com',
      phone: ['+251915950217', '+251941274261'],
      bio: 'Passionate software engineer specializing in full-stack and mobile development.',
    },
    skills: {
      frontend: ['React', 'Vue', 'HTML', 'CSS', 'TailwindCSS', 'JavaScript'],
      backend: ['Node.js', 'Express', 'Django', 'Flask'],
      mobile: ['Flutter', 'React Native'],
      devops: ['Docker', 'Git', 'AWS', 'Heroku'],
    },
  });
});

module.exports = router;
