import http from './http';

export const getReportCatalog = async () => {
  const { data } = await http.get(`/admin/reports`);
  return data;
};
export const getReport = async (type, params) => {
  const { data } = await http.get(`/admin/reports/${type}?${params}`);
  return data;
};

// **Authentications** _________________________________________________________________________________________________________

export const login = async (payload) => {
  const { data } = await http.post(`/auth/adminlogin`, payload);
  return data;
};

// **Admin Dashboard** _________________________________________________________________________________________________________
export const adminDashboardAnalytics = async () => {
  const { data } = await http.get(`/admin/dashboard-analytics`);
  return data;
};
export const getNotifications = async ({ page = 1, limit = 10, unread = false } = {}) => {
  const { data } = await http.get(`/admin/notifications?page=${page}&limit=${limit}&unread=${unread}`);
  return data;
};
export const markNotificationRead = async (id) =>
  (await http.patch(`/admin/notifications/${id}/read`)).data;
export const markAllNotificationsRead = async () =>
  (await http.patch('/admin/notifications/read-all')).data;
export const deleteNotification = async (id) =>
  (await http.delete(`/admin/notifications/${id}`)).data;

export const getOrdersByAdmin = async (payload) => {
  const { data } = await http.get(`/admin/orders?${payload}`);
  return data;
};
export const getOrderItemsByAdmin = async (payload) => {
  const { data } = await http.get(`/admin/order-items?${payload}`);
  return data;
};

export const getStatusesByModel = async (model) => {
  const { data } = await http.get(`/admin/statuses?model=${model}`);
  return data;
};
export const createStatusByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/statuses`, payload);
  return data;
};
export const updateStatusByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/statuses/${id}`, payload);
  return data;
};
export const deleteStatusByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/statuses/${id}`);
  return data;
};
export const getOrderByAdmin = async (orderNo) => {
  const { data } = await http.get(`/admin/orders/${orderNo}`);
  return data;
};
export const getOrderFinanceActionsByAdmin = async (params = {}) => {
  const { data } = await http.get('/admin/order-finance-actions', { params });
  return data;
};
export const updateOrderFinanceActionByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.patch(`/admin/order-finance-actions/${id}`, payload);
  return data;
};
export const deleteOrderByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/orders/${id}`);
  return data;
};
export const updateOrderStatus = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/orders/${id}`, payload);
  return data;
};
export const logout = async () => {
  const { data } = await http.post('/auth/logout', { scope: 'admin' });
  return data;
};
export const addOrderAdminComment = async ({ orderNo, ...payload }) => {
  const { data } = await http.post(`/admin/orders/${orderNo}/comments`, payload);
  return data;
};
export const updateOrderStatusByAdmin = async ({ orderNo, ...payload }) => {
  const { data } = await http.put(`/admin/updateorderstatus/${orderNo}`, payload);
  return data;
};
export const getUsersByAdmin = async (params) => {
  const { data: response } = await http.get(`/admin/users?${params}`);
  return response;
};
export const getAdminsByAdmin = async (params) => {
  const { data: response } = await http.get(`/admin/admins?${params}`);
  return response;
};
export const getUserByAdmin = async (id) => {
  const { data: response } = await http.get(`/admin/users/${id}`);
  return response;
};
export const updateUserRoleByAdmin = async (id) => {
  const { data: response } = await http.post(`/admin/users/role/${id}`);
  return response;
};
// Explicit role assignment (user | admin | salesman); branch required for salesman
export const assignUserRoleByAdmin = async ({ id, role, branch }) => {
  const { data: response } = await http.post(`/admin/users/role/${id}`, { role, branch });
  return response;
};
export const updateUserStatusByAdmin = async (id) => {
  const { data: response } = await http.post(`/admin/users/status/${id}`);
  return response;
};
export const getUserActivityByAdmin = async (phone) => {
  const { data: response } = await http.get(`/admin/users/${encodeURIComponent(phone)}/activity`);
  return response;
};
export const getUserOrdersByAdmin = async (phone, page = 1) => {
  const { data: response } = await http.get(`/admin/users/${encodeURIComponent(phone)}/orders?page=${page}&limit=15`);
  return response;
};
export const getUserCashByAdmin = async (phone, page = 1) => {
  const { data: response } = await http.get(`/admin/users/${encodeURIComponent(phone)}/cash?page=${page}&limit=20`);
  return response;
};
export const getUserCouponUsagesByAdmin = async (phone, page = 1) => {
  const { data: response } = await http.get(
    `/admin/users/${encodeURIComponent(phone)}/coupon-usages?page=${page}&limit=20`
  );
  return response;
};
export const getUserAddressesByAdmin = async (phone) => {
  const { data: response } = await http.get(`/admin/users/${encodeURIComponent(phone)}/addresses`);
  return response;
};
export const getUserReviewsByAdmin = async (phone, page = 1) => {
  const { data: response } = await http.get(`/admin/users/${encodeURIComponent(phone)}/reviews?page=${page}&limit=20`);
  return response;
};

export const getCouponCodesByAdmin = async (page, search, status, type, sortBy, sortOrder) => {
  const params = new URLSearchParams({
    page: page || 1,
    ...(search && { search }),
    ...(status && { status }),
    ...(type && { type }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();
  const { data: response } = await http.get(`/admin/coupon-codes?${params}`);
  return response;
};

export const getCouponCodeByAdmin = async (id) => {
  const { data: response } = await http.get(`/admin/coupon-codes/${id}`);
  return response;
};

export const addCouponCodeByAdmin = async (payload) => {
  const { data: response } = await http.post(`/admin/coupon-codes`, payload);
  return response;
};
export const updateCouponCodeByAdmin = async ({ currentId, ...others }) => {
  const { data: response } = await http.put(`/admin/coupon-codes/${currentId}`, others);
  return response;
};
export const deleteCouponCodeByAdmin = async (id) => {
  const { data: response } = await http.delete(`/admin/coupon-codes/${id}`);
  return response;
};
export const getCouponUsageByAdmin = async (id, page = 1) => {
  const { data: response } = await http.get(`/admin/coupon-codes/${id}/usages?page=${page}&limit=25`);
  return response;
};

export const getNewsletter = async (page) => {
  const { data } = await http.get(`/admin/newsletter?page=${page}`);
  return data;
};

export const getIncomeDetailsByAdmin = async (pid, page) => {
  const { data } = await http.get(`/admin/payments/${pid}?page=${page || 1}`);
  return data;
};
export const editPaymentByAdmin = async ({ pid, ...payload }) => {
  const { data } = await http.put(`/admin/payments/${pid}`, { ...payload });
  return data;
};
export const createPaymentByAdmin = async ({ ...payload }) => {
  const { data } = await http.post(`/admin/payments`, { ...payload });
  return data;
};
export const getPayoutsByAdmin = async (params) => {
  const { data } = await http.get(`/admin/payouts?${params}`);
  return data;
};
export const getCampaignsByAdmin = async (page, search, type, sortBy, sortOrder) => {
  const params = new URLSearchParams({
    page: page || 1,
    ...(search && { search }),
    ...(type && { type }),
    ...(sortBy && { sortBy, sortOrder })
  }).toString();
  const { data } = await http.get(`/admin/campaigns?${params}`);
  return data;
};
export const addCampaignByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/campaigns`, payload);
  return data;
};
export const updateCampaignByAdmin = async ({ currentSlug, ...payload }) => {
  const { data } = await http.put(`/admin/campaigns/${currentSlug}`, payload);
  return data;
};
export const getCampaignByAdmin = async (slug) => {
  const { data } = await http.get(`/admin/campaigns/${slug}`);
  return data;
};
export const deleteCampaignByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/campaigns/${id}`);
  return data;
};

// Homepage Sections
export const getHomepageSectionsAdmin = async () => {
  const { data } = await http.get(`/admin/homepage-sections`);
  return data;
};
export const createHomepageSection = async (payload) => {
  const { data } = await http.post(`/admin/homepage-sections`, payload);
  return data;
};
export const updateHomepageSection = async (id, payload) => {
  const { data } = await http.put(`/admin/homepage-sections/${id}`, payload);
  return data;
};
export const deleteHomepageSection = async (id) => {
  const { data } = await http.delete(`/admin/homepage-sections/${id}`);
  return data;
};
export const reorderHomepageSections = async (ids) => {
  const { data } = await http.put(`/admin/homepage-sections/reorder`, { ids });
  return data;
};

export const getProductReviews = async (pid) => {
  const { data } = await http.get(`/reviews/${pid}`);
  return data;
};
export const getProductReviewsAll = async () => {
  const { data } = await http.get(`/reviews`);
  return data;
};
export const addReview = async (payload) => {
  const { data } = await http.post(`/reviews`, payload);
  return data;
};

export const getUserInvoice = async (page) => {
  const { data: response } = await http.get(`/users/invoice${page}`);
  return response;
};

export const updateProfile = async ({ ...payload }) => {
  const { data } = await http.put(`/users/profile`, payload);
  return data;
};
export const changePassword = async ({ ...payload }) => {
  const { data } = await http.put(`/users/change-password`, payload);
  return data;
};

export const getAddress = async (payload) => {
  const { data } = await http.get(`/users/addresses?id=${payload}`);
  return data;
};
export const updateAddress = async ({ id, ...payload }) => {
  const { data } = await http.put(`/users/addresses/${id}`, payload);
  return data;
};
export const createAddress = async ({ ...payload }) => {
  const { data } = await http.post(`/users/addresses/`, payload);
  return data;
};
export const deleteAddress = async ({ id }) => {
  const { data } = await http.delete(`/users/addresses/${id}`);
  return data;
};
export const search = async (payload) => {
  const { data } = await http.post(`/search`, payload);
  return data;
};
export const getSearchFilters = async () => {
  const { data } = await http.get(`/search-filters`);
  return data;
};
export const getInvoices = async () => {
  const { data } = await http.get(`/users/invoice`);
  return data;
};
export const placeOrder = async (payload) => {
  const { data } = await http.post(`/orders`, payload);
  return data;
};
export const getLayout = async () => {
  const { data } = await http.get(`/layout`);
  return data;
};
export const singleDeleteFile = async (id) => {
  const { data } = await http.delete(`/delete-file/${id}`);
  return data;
};

export const sendNewsletter = async (payload) => {
  const { data } = await http.post(`/newsletter`, payload);
  return data;
};

export const getWishlist = async () => {
  const { data } = await http.get(`/wishlist`);
  return data;
};
export const updateWishlist = async (productId) => {
  const { data } = await http.post(`/wishlist/toggle`, { productId });
  return data;
};
export const clearWishlist = async () => {
  const { data } = await http.delete(`/wishlist`);
  return data;
};

export const getProfile = async () => {
  const { data } = await http.get(`/users/profile`);
  return data;
};

export const getCart = async (ids) => {
  const { data } = await http.post(`/cart`, {
    products: ids
  });
  return data;
};

export const getHomeCampaigns = async () => {
  const { data } = await http.get(`/campaigns`);
  return data;
};

export const getHomeBrands = async () => {
  const { data } = await http.get(`/home/brands`);
  return data;
};
export const getBrands = async () => {
  const { data } = await http.get(`/brands`);
  return data;
};
export const applyCouponCode = async (code) => {
  const { data: response } = await http.get(`/coupon-codes/${code}`);
  return response;
};

export const paymentIntents = async (amount, currency) => {
  const { data } = await http.post(`/payment-intents`, {
    amount,
    currency
  });
  return data;
};

export const getCampaignSlugs = async () => {
  const { data } = await http.get('/campaigns-slugs');
  return data;
};
export const getCampaignBySlug = async (slug) => {
  const { data } = await http.get(`/campaigns/${slug}`);
  return data;
};
export const getCampaignTitle = async (slug) => {
  const { data } = await http.get(`/campaign-title/${slug}`);
  return data;
};

// export const contactUs = async (payload) => {
//   const { data } = await http.post(`/contact-us`, payload);
//   return data;
// };

//products
export const getProductsByAdmin = async (params) => {
  const { data: response } = await http.get(`/admin/products?${params}`);
  return response;
};
export const searchProducts = async ({ search = '', limit = 8 } = {}) => {
  const { data } = await http.get(
    `/admin/products?search=${encodeURIComponent(search)}&limit=${limit}&populate=variations`
  );
  return data;
};
export const getLastProductCode = async (params) => {
  const { data: response } = await http.get(`/productlastcode`);
  return response;
};
export const getOneProductByAdmin = async (slug) => {
  const { data } = await http.get(`/admin/products/${slug}`);
  return data;
};
export const createProductByAdmin = async (payload) => {
  const { data: response } = await http.post(`/admin/products`, payload);
  return response;
};
export const updateProductByAdmin = async ({ currentSlug, ...payload }) => {
  const { data: response } = await http.put(`/admin/products/${currentSlug}`, payload);
  return response;
};
export const updateVariationPresale = async ({ slug, variationId, enabled }) => {
  const { data } = await http.patch(`/admin/products/${slug}/variations/${variationId}/presale`, { enabled });
  return data;
};
export const deleteProductByAdmin = async (slug) => {
  const { data: response } = await http.delete(`/admin/products/${slug}`);
  return response;
};

export const getProducts = async (query) => {
  const { data } = await http.get(`/products?${query}`);
  return data;
};
export const getProductBySlug = async (slug) => {
  const { data } = await http.get(`/products/${slug}`);
  return data;
};
export const getProductSlugs = async () => {
  const { data } = await http.get(`/products-slugs`);
  return data;
};

export const getAllFilters = async () => {
  const { data } = await http.get(`/products/filter/filters`);
  return data;
};

export const getProductsByCategory = async (query = '', category, rate) => {
  const { data } = await http.get(`/category/products/${category}${query || '?'}&rate=${rate}`);
  return data;
};
export const getProductsByCampaign = async (query = '', slug, rate) => {
  const { data } = await http.get(`/campaign/products/${slug}${query || '?'}&rate=${rate}`);
  return data;
};

export const getBestSellingProducts = async () => {
  const { data } = await http.get(`/home/products/best-selling`);
  return data;
};
export const getFeaturedProducts = async () => {
  const { data } = await http.get(`/home/products/featured`);
  return data;
};

export const getTopRatedProducts = async () => {
  const { data } = await http.get(`/home/products/top`);
  return data;
};

export const getNewProducts = async () => {
  const { data } = await http.get(`/products/new`);
  return data;
};

export const getNewArrivels = async () => {
  const { data } = await http.get('/new-arrivals');
  return data;
};
export const getRelatedProducts = async (pid) => {
  const { data } = await http.get(`/related-products/${pid}`);
  return data;
};

export const getLowStockProductsByAdmin = async (page) => {
  const { data: response } = await http.get(`/admin/low-stock-products?page=${page}`);
  return response;
};

//categories
export const getAllCategoriesByAdmin = async () => {
  const { data } = await http.get(`/admin/all-categories`); //
  return data;
};
export const getCategoriesByAdmin = async (params) => {
  const { data } = await http.get(`/admin/categories?${params}`); //
  return data;
};
export const addCategoryByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/categories`, payload); //
  return data;
};
export const updateCategoryByAdmin = async ({ currentSlug, ...payload }) => {
  const { data } = await http.put(`/admin/categories/${currentSlug}`, payload); //
  return data;
};
export const deleteCategoryByAdmin = async (slug) => {
  const { data } = await http.delete(`/admin/categories/${slug}`); //
  return data;
};

export const getCategoryBySlug = async (category) => {
  const { data } = await http.get(`/categories/${category}`); //
  return data;
};

export const getCategorySlugs = async () => {
  const { data } = await http.get(`/categories-slugs`); //
  return data;
};
export const getAllCategories = async () => {
  const { data } = await http.get(`/all-categories`); //
  return data;
};
export const getHomeCategories = async () => {
  const { data } = await http.get(`/home/categories`);
  return data;
};

//image
export const uploadImage = async (payload, config = {}) => {
  const { data } = await http.post(`/upload/upload-single`, payload, config);
  return data;
};
export const uploadImages = async (payload) => {
  const { data } = await http.post(`/upload/upload-multiple`, payload);
  return data;
};

//orders
export const getUserOrders = async (query) => {
  const { data } = await http.get(`/orders?${query}`);
  return data;
};

//banners

export const getHomeBanners = async () => {
  const { data } = await http.get(`/homebanners`);
  return data;
};
export const getHomeBannersAdmin = async () => {
  const { data } = await http.get(`/admin/homebanners`);
  return data;
};
export const createHomeBanner = async (payload) => {
  const { data } = await http.post(`/admin/homebanners`, payload);
  return data;
};
export const updateHomeBanner = async (id, payload) => {
  const { data } = await http.put(`/admin/homebanners/${id}`, payload);
  return data;
};
export const deleteHomeBanner = async (id) => {
  const { data } = await http.delete(`/admin/homebanners/${id}`);
  return data;
};
export const reorderHomeBanners = async (ids) => {
  const { data } = await http.put(`/admin/homebanners/reorder`, { ids });
  return data;
};

//couriers

export const fraudCheck = async (phone) => {
  const { data } = await http.get(`/couriers/fraud?phone=${phone}`);
  return data;
};

// Resolve best shipping charge for a district/upazila (exact -> district-wide -> global fallback)
export const getShippingCharge = async (district, upazila) => {
  const params = new URLSearchParams({ district: district || 'ALL', upazila: upazila || 'ALL' });
  const { data } = await http.get(`/shipping/charge?${params}`);
  return data;
};

//couriers
export const getAllShippingCharges = async (params) => {
  const { data } = await http.get(`/admin/shipping?${params}`);
  return data;
};

export const getShippingChargeByAdmin = async (id) => {
  const { data } = await http.get(`/admin/shipping/${id}`);
  return data;
};
export const addShippingChargeByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/shipping`, payload);
  return data;
};
export const updateShippingChargeByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/shipping/${id}`, payload);
  return data;
};
export const deleteShippingChargeByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/shipping/${id}`);
  return data;
};

export const enableFreeShipping = async () => {
  const { data } = await http.post(`admin/shipping/free/enable`);
  return data;
};
export const disableFreeShipping = async () => {
  const { data } = await http.post(`admin/shipping/free/disable`);
  return data;
};

// â”€â”€ Attributes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getAllAttributesWithValues = async () => {
  const { data } = await http.get(`/attributes/all-with-values`);
  return data;
};
export const createAttributeByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/attributes`, payload);
  return data;
};
export const updateAttributeByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/attributes/${id}`, payload);
  return data;
};
export const deleteAttributeByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/attributes/${id}`);
  return data;
};
export const createAttributeValueByAdmin = async ({ attributeId, ...payload }) => {
  const { data } = await http.post(`/admin/attributes/${attributeId}/values`, payload);
  return data;
};
export const updateAttributeValueByAdmin = async ({ attributeId, valueId, ...payload }) => {
  const { data } = await http.put(`/admin/attributes/${attributeId}/values/${valueId}`, payload);
  return data;
};
export const deleteAttributeValueByAdmin = async ({ attributeId, valueId }) => {
  if (!attributeId || !valueId) {
    throw new Error('Attribute and value IDs are required.');
  }
  const { data } = await http.delete(`/admin/attributes/${attributeId}/values/${valueId}`);
  return data;
};

// Inventory limits
export const getInventoryLimitsByAdmin = async () => {
  const { data } = await http.get(`/admin/inventory-limits`);
  return data;
};
export const createInventoryLimitByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/inventory-limits`, payload);
  return data;
};
export const updateInventoryLimitByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/inventory-limits/${id}`, payload);
  return data;
};
export const deleteInventoryLimitByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/inventory-limits/${id}`);
  return data;
};

// â”€â”€ Cash Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getCashSettings = async () => {
  const { data } = await http.get(`/cash/settings`);
  return data;
};
export const updateCashSettings = async (payload) => {
  const { data } = await http.put(`/admin/cash/settings`, payload);
  return data;
};
export const adminAdjustCash = async (payload) => {
  const { data } = await http.post(`/admin/cash/adjust`, payload);
  return data;
};
export const getUserCashList = async (page = 1, search = '') => {
  const params = new URLSearchParams({ page, limit: 25, ...(search && { search }) }).toString();
  const { data } = await http.get(`/admin/cash/users?${params}`);
  return data;
};
export const getAllCashTransactions = async (page = 1, type = '', search = '') => {
  const params = new URLSearchParams({ page, limit: 25, ...(type && { type }), ...(search && { search }) }).toString();
  const { data } = await http.get(`/admin/cash/transactions?${params}`);
  return data;
};
export const getUserCashHistory = async (userId) => {
  const { data } = await http.get(`/admin/cash/users/${userId}/history`);
  return data;
};

// â”€â”€ Site Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getApiSettingByAdmin = async (service) => {
  const { data } = await http.get(`/admin/api-settings/${service}`);
  return data;
};
export const updateApiSettingByAdmin = async ({ service, ...payload }) => {
  const { data } = await http.put(`/admin/api-settings/${service}`, payload);
  return data;
};

export const getSiteSettings = async () => {
  const { data } = await http.get(`/settings`);
  return data;
};
export const getSiteSettingsByAdmin = async () => {
  const { data } = await http.get(`/admin/settings`);
  return data;
};
export const updateSiteSettings = async (payload) => {
  const { data } = await http.put(`/admin/settings`, payload);
  return data;
};
export const uploadSiteLogo = async (formData) => {
  const { data } = await http.post(`/admin/settings/logo`, formData);
  return data;
};
export const uploadSiteFavicon = async (formData) => {
  const { data } = await http.post(`/admin/settings/favicon`, formData);
  return data;
};

// â”€â”€ Order item CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const addItemToOrder = async ({ orderNo, ...payload }) => {
  const { data } = await http.post(`/admin/orders/${orderNo}/items`, payload);
  return data;
};
export const removeItemFromOrder = async ({ orderNo, itemId }) => {
  const { data } = await http.delete(`/admin/orders/${orderNo}/items/${itemId}`);
  return data;
};
export const updateItemInOrder = async ({ orderNo, itemId, ...payload }) => {
  const { data } = await http.put(`/admin/orders/${orderNo}/items/${itemId}`, payload);
  return data;
};
export const removeOrderPayment = async ({ orderNo, paymentId }) => {
  const { data } = await http.delete(`/admin/orders/${orderNo}/payments/${paymentId}`);
  return data;
};
export const addOrderPayment = async ({ orderNo, ...payload }) => {
  const { data } = await http.post(`/admin/orders/${orderNo}/payments`, payload);
  return data;
};

// Courier accounts + shipments
export const getCourierAccounts = async () => {
  const { data } = await http.get('/admin/courier-accounts');
  return data;
};
export const createCourierAccount = async (payload) => {
  const { data } = await http.post('/admin/courier-accounts', payload);
  return data;
};
export const updateCourierAccount = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/courier-accounts/${id}`, payload);
  return data;
};
export const setDefaultCourierAccount = async (id) => {
  const { data } = await http.put(`/admin/courier-accounts/${id}/default`);
  return data;
};
export const deleteCourierAccount = async (id) => {
  const { data } = await http.delete(`/admin/courier-accounts/${id}`);
  return data;
};
export const getCourierAccountBalance = async (id) => {
  const { data } = await http.get(`/admin/courier-accounts/${id}/balance`);
  return data;
};
export const getCourierOptions = async () => {
  const { data } = await http.get('/admin/courier-options');
  return data;
};
export const getOrderShipments = async (orderNo) => {
  const { data } = await http.get(`/admin/orders/${orderNo}/shipments`);
  return data;
};
export const getShipmentsByAdmin = async (params) => {
  const { data } = await http.get('/admin/shipments', { params });
  return data;
};
export const createOrderShipment = async ({ orderNo, ...payload }) => {
  const { data } = await http.post(`/admin/orders/${orderNo}/shipments`, payload);
  return data;
};
export const refreshShipmentStatus = async (id) => {
  const { data } = await http.post(`/admin/shipments/${id}/refresh`);
  return data;
};
export const reconcileShipmentIntent = async ({ id, ...payload }) => {
  const { data } = await http.patch(`/admin/shipments/${id}/intent-review`, payload);
  return data;
};
export const getEditHistory = async ({ model, docId }) => {
  const { data } = await http.get(`/admin/edit-history`, { params: { model, docId } });
  return data;
};

// Branches
export const adminGetBranches = async () => {
  const { data } = await http.get('/admin/branches');
  return data;
};
export const adminCreateBranch = async (payload) => {
  const { data } = await http.post('/admin/branches', payload);
  return data;
};
export const adminUpdateBranch = async ({ id, ...payload }) => {
  const { data } = await http.put('/admin/branches/' + id, payload);
  return data;
};
export const adminDeleteBranch = async (id) => {
  const { data } = await http.delete('/admin/branches/' + id);
  return data;
};

// ── Message settings (SMS templates + toggles) ────────────────────────────────
export const getMessageSettings = async () => {
  const { data } = await http.get('/admin/message-settings');
  return data;
};
export const updateMessageSettings = async (payload) => {
  const { data } = await http.put('/admin/message-settings', payload);
  return data;
};

// ── Order Tags ────────────────────────────────────────────────────────────────
export const getOrderTagsByAdmin = async (params = '') => {
  const { data } = await http.get(`/admin/order-tags?${params}`);
  return data;
};
export const createOrderTagByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/order-tags`, payload);
  return data;
};
export const updateOrderTagByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/order-tags/${id}`, payload);
  return data;
};
export const deleteOrderTagByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/order-tags/${id}`);
  return data;
};

// ── Admin Order Creation ──────────────────────────────────────────────────────
export const lookupCustomerByAdmin = async (phone) => {
  const { data } = await http.get(`/admin/customers/lookup?phone=${encodeURIComponent(phone)}`);
  return data;
};
export const createGuestCustomer = async (payload) => {
  const { data } = await http.post(`/admin/customers/guest`, payload);
  return data;
};
export const updateGuestName = async ({ id, name }) => {
  const { data } = await http.put(`/admin/customers/guest/${id}`, { name });
  return data;
};
export const createAdminOrder = async (payload) => {
  const { data } = await http.post(`/admin/orders/create`, payload);
  return data;
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const getPaymentsByAdmin = async (params = {}) => {
  const { data } = await http.get(`/admin/payments`, { params });
  return data;
};
export const getPaymentByTrxId = async (trxId) => {
  const value = String(trxId || '').trim();
  if (!value) throw new Error('Transaction ID is required');
  const { data } = await http.get('/admin/payments/trx', { params: { trxId: value } });
  return data;
};
export const assignPaymentByAdmin = async ({ id, orderNo }) => {
  const { data } = await http.put(`/admin/payments/${id}/assign`, { orderNo });
  return data;
};
export const getWebhookConfig = async () => {
  const { data } = await http.get(`/admin/payments/webhook-config`);
  return data;
};
export const regenerateWebhookSecret = async () => {
  const { data } = await http.post(`/admin/payments/webhook-regenerate`);
  return data;
};

// ── Payment Types ─────────────────────────────────────────────────────────────
export const getPaymentTypesByAdmin = async () => {
  const { data } = await http.get(`/admin/payment-types`);
  return data;
};
export const createPaymentTypeByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/payment-types`, payload);
  return data;
};
export const updatePaymentTypeByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/payment-types/${id}`, payload);
  return data;
};
export const deletePaymentTypeByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/payment-types/${id}`);
  return data;
};
export const addPaymentToOrder = async ({ orderNo, ...payload }) => {
  const { data } = await http.post(`/admin/orders/${orderNo}/payments`, payload);
  return data;
};
export const verifyOrderPayment = async ({ orderNo, paymentId, status }) => {
  const { data } = await http.put(`/admin/orders/${orderNo}/payments/${paymentId}/verify`, { status });
  return data;
};

// ── Complaints ────────────────────────────────────────────────────────────────
export const getComplaintsByAdmin = async (params = '') => {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  const { data } = await http.get(`/admin/complaints?${query}`);
  return data;
};
export const getComplaintByAdmin = async (id) => {
  const { data } = await http.get(`/admin/complaints/${id}`);
  return data;
};
export const getComplaintImageByAdmin = async (complaintId, imageId) => {
  const { data } = await http.get(`/admin/complaints/${complaintId}/images/${imageId}`, { responseType: 'blob' });
  return data;
};
export const createComplaintByAdmin = async (payload) => {
  const { data } = await http.post(`/admin/complaints`, payload);
  return data;
};
export const uploadComplaintImagesByAdmin = async (formData) => {
  const { data } = await http.post(`/admin/complaints/images`, formData);
  return data;
};
export const updateComplaintByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/complaints/${id}`, payload);
  return data;
};

// ── Branch Finance ────────────────────────────────────────────────────────────
// Expense types
export const getExpenseTypesByAdmin = async () => {
  const { data } = await http.get('/admin/expense-types');
  return data;
};
export const createExpenseTypeByAdmin = async (payload) => {
  const { data } = await http.post('/admin/expense-types', payload);
  return data;
};
export const updateExpenseTypeByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.put(`/admin/expense-types/${id}`, payload);
  return data;
};
export const deleteExpenseTypeByAdmin = async (id) => {
  const { data } = await http.delete(`/admin/expense-types/${id}`);
  return data;
};

// Branch expenses (review)
export const getExpensesByAdmin = async (params = '') => {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  const { data } = await http.get(`/admin/expenses?${query}`);
  return data;
};
export const getExpenseByAdmin = async (id) => {
  const { data } = await http.get(`/admin/expenses/${id}`);
  return data;
};
export const getExpenseImageByAdmin = async (expenseId, imageId) => {
  const { data } = await http.get(`/admin/expenses/${expenseId}/images/${imageId}`, { responseType: 'blob' });
  return data;
};
export const reviewExpenseByAdmin = async ({ id, ...payload }) => {
  const { data } = await http.patch(`/admin/expenses/${id}/review`, payload);
  return data;
};

// Branch payment methods
export const getBranchPaymentMethodsByAdmin = async (branchId) => {
  const { data } = await http.get(`/admin/branches/${branchId}/payment-methods`);
  return data;
};
export const createBranchPaymentMethodByAdmin = async ({ branchId, ...payload }) => {
  const { data } = await http.post(`/admin/branches/${branchId}/payment-methods`, payload);
  return data;
};
export const updateBranchPaymentMethodByAdmin = async ({ branchId, id, ...payload }) => {
  const { data } = await http.put(`/admin/branches/${branchId}/payment-methods/${id}`, payload);
  return data;
};
export const deleteBranchPaymentMethodByAdmin = async ({ branchId, id }) => {
  const { data } = await http.delete(`/admin/branches/${branchId}/payment-methods/${id}`);
  return data;
};

// Branch cash
export const getBranchCashBalanceByAdmin = async (branchId) => {
  const { data } = await http.get(`/admin/branch-cash/${branchId}/balance`);
  return data;
};
export const getBranchCashEntriesByAdmin = async (branchId, params = '') => {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  const { data } = await http.get(`/admin/branch-cash/${branchId}/entries?${query}`);
  return data;
};
export const createBranchCashEntryByAdmin = async ({ branchId, ...payload }) => {
  const { data } = await http.post(`/admin/branch-cash/${branchId}/entries`, payload);
  return data;
};

// Monthly branch audit report
export const getBranchAuditReportByAdmin = async (params = '') => {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  const { data } = await http.get(`/admin/audit-report?${query}`);
  return data;
};

// Order Settings
export const getOrderSettings = async () => {
  const { data } = await http.get('/order-settings');
  return data;
};
export const updateOrderSettings = async (payload) => {
  const { data } = await http.put('/admin/order-settings', payload);
  return data;
};

// Recycle bin (super admin)
export const getTrashSummary = async () => {
  const { data } = await http.get('/admin/trash/summary');
  return data;
};
export const getTrashItems = async (params) => {
  const { data } = await http.get(`/admin/trash?${params}`);
  return data;
};
export const restoreTrashItem = async ({ model, id }) => {
  const { data } = await http.post(`/admin/trash/${model}/${id}/restore`);
  return data;
};

// POS Settings (VAT, exchange policy)
export const getPosSettings = async () => {
  const { data } = await http.get('/admin/pos-settings');
  return data;
};
export const updatePosSettings = async (payload) => {
  const { data } = await http.put('/admin/pos-settings', payload);
  return data;
};

// Inventory, branch transfers and production.
// Branch locations are managed via the /admin/branches endpoints above (adminGetBranches etc.).
export const getInventoryBalances = async (params = {}) =>
  (await http.get('/admin/inventory/balances', { params })).data;
export const getStockLots = async (params = {}) => (await http.get('/admin/inventory/lots', { params })).data;
export const getInventoryTransactions = async (params = {}) =>
  (await http.get('/admin/inventory/transactions', { params })).data;
export const resolveInventoryBarcode = async ({ code, branch }) =>
  (await http.get(`/admin/inventory/barcodes/${encodeURIComponent(code)}`, { params: { branch } })).data;
export const getStockTransfers = async (params = {}) => (await http.get('/admin/inventory/transfers', { params })).data;
export const createStockTransfer = async (payload) => (await http.post('/admin/inventory/transfers', payload)).data;
export const approveStockTransfer = async (id) => (await http.post(`/admin/inventory/transfers/${id}/approve`)).data;
export const dispatchStockTransfer = async (id) => (await http.post(`/admin/inventory/transfers/${id}/dispatch`)).data;
export const receiveStockTransfer = async (id) => (await http.post(`/admin/inventory/transfers/${id}/receive`)).data;
export const getProductStockList = async (params = {}) =>
  (await http.get('/admin/inventory/products', { params })).data;
export const getProductStockDetail = async (id) =>
  (await http.get(`/admin/inventory/products/${id}`)).data;
export const packOrderByAdmin = async (orderNo) => (await http.post(`/admin/orders/${orderNo}/pack`)).data;
export const scanOrderItemForPacking = async ({ orderNo, barcode, itemId, manual = false }) =>
  (await http.post(`/admin/orders/${orderNo}/pack/scan`, { barcode, itemId, manual })).data;

export const getProductionNeeds = async (params = {}) => (await http.get('/admin/production/order-items', { params })).data;
export const assignProductionNeedToStock = async (id) =>
  (await http.post(`/admin/production/order-items/${id}/assign-stock`)).data;
export const getProductionBatches = async (params = {}) =>
  (await http.get('/admin/production/batches', { params })).data;
export const createProductionBatch = async (payload) => (await http.post('/admin/production/batches', payload)).data;
export const updateProductionBatch = async ({ id, ...payload }) =>
  (await http.put(`/admin/production/batches/${id}`, payload)).data;
export const startProductionBatch = async (id) => (await http.post(`/admin/production/batches/${id}/start`)).data;
export const getProductionBatchUnits = async (id) => (await http.get(`/admin/production/batches/${id}/units`)).data;
export const submitProductionSubmission = async (payload) =>
  (await http.post('/admin/production/submissions', payload)).data;
export const submitProductionUnit = async ({ barcode, ...payload }) =>
  (await http.post(`/admin/production/units/${barcode}/submit`, payload)).data;
export const searchProductionProducers = async (q) =>
  (await http.get('/admin/production/producers', { params: { q } })).data;

// **Roles & Permissions (ABAC)** ______________________________________________________________________________________
export const getMyAbility = async () => {
  const { data } = await http.get(`/admin/me`);
  return data;
};
// Role CRUD (create/edit/delete) is managed entirely from the HRM app now —
// this app only lists roles (for the assign-role dropdown) and assigns them.
export const getRolesByAdmin = async () => {
  const { data } = await http.get(`/admin/roles`);
  return data;
};
export const assignRoleByAdmin = async (slug, payload) => {
  const { data } = await http.post(`/admin/roles/${slug}/assign`, payload);
  return data;
};
export const getAccessLogs = async (params = '') => {
  const { data } = await http.get(`/admin/access-logs?${params}`);
  return data;
};
