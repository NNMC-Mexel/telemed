export default {
  routes: [
    {
      method: 'GET',
      path: '/global/patient-guide',
      handler: 'global.patientGuide',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
