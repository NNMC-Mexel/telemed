/**
 * Custom routes for medical-document sharing.
 * IMPORTANT: /my-doctors MUST come before /:id routes to avoid being matched as findOne.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/medical-documents/my-doctors',
      handler: 'medical-document.myDoctors',
      info: {
        apiName: 'medical-document',
        type: 'content-api',
      },
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/medical-documents/:id/share',
      handler: 'medical-document.share',
      info: {
        apiName: 'medical-document',
        type: 'content-api',
      },
      config: {
        policies: [],
      },
    },
  ],
};
