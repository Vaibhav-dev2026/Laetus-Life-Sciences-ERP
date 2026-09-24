const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { generateId } = require('../utils/idGenerator');
const { logAudit } = require('../services/audit.service');

// Generic list/get/create/update/deactivate/remove controller factory for simple
// master-data resources (Customer, Supplier, Product). Sale/Purchase/Payment/
// Returns have dedicated controllers because they carry real transactional
// business logic that must not be genericized.
function createCrudController({ Model, idPrefix, counterKey, moduleName, searchFields = [], entityName = 'Record', dependencyCheckFn = null }) {
  const list = asyncHandler(async (req, res) => {
    const { search, status, page = 1, limit = 100 } = req.query;
    const query = {};
    if (status && status !== 'All') query.status = status;
    if (search && searchFields.length) {
      query.$or = searchFields.map((f) => ({ [f]: { $regex: search, $options: 'i' } }));
    }
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(5000, Math.max(1, Number(limit)));
    const [data, total] = await Promise.all([
      Model.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Model.countDocuments(query),
    ]);
    return ApiResponse.success(res, {
      data,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  });

  const getById = asyncHandler(async (req, res) => {
    const record = await Model.findOne({ id: req.params.id });
    if (!record) throw ApiError.notFound(`${entityName} not found`);
    return ApiResponse.success(res, { data: record });
  });

  const create = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    delete payload._id;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.__v;

    if (payload.sku) {
      const normSku = String(payload.sku).trim().toUpperCase();
      const existingSku = await Model.findOne({ sku: normSku });
      if (existingSku) {
        throw ApiError.conflict(`A product with SKU "${normSku}" already exists. Please use a unique SKU.`);
      }
    }

    if (req.body.id) {
      const existingId = await Model.findOne({ id: req.body.id });
      if (existingId) {
        throw ApiError.conflict(`A ${entityName.toLowerCase()} with ID "${req.body.id}" already exists.`);
      }
    }

    const generatedId = req.body.id || await generateId(idPrefix, counterKey, 6, null, Model);
    const schemaStatusPath = Model.schema.path('status');
    const validStatuses = schemaStatusPath && schemaStatusPath.enumValues ? schemaStatusPath.enumValues : [];
    const defaultStatus = validStatuses.includes('Active') ? 'Active' : (validStatuses[0] || 'Active');
    const record = await Model.create({ ...payload, id: generatedId, status: payload.status || defaultStatus });
    await logAudit({ user: req.user?.name, action: 'Create', module: moduleName, reference: generatedId, after: record.toObject() });
    return ApiResponse.created(res, { message: `${entityName} created successfully`, data: record });
  });

  const update = asyncHandler(async (req, res) => {
    const before = await Model.findOne({ id: req.params.id });
    if (!before) throw ApiError.notFound(`${entityName} not found`);
    const beforeObj = before.toObject();

    const payload = { ...req.body };
    delete payload._id;
    delete payload.id;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.__v;

    if (payload.sku && String(payload.sku).trim().toUpperCase() !== String(before.sku || '').trim().toUpperCase()) {
      const normSku = String(payload.sku).trim().toUpperCase();
      const existingSku = await Model.findOne({ sku: normSku, id: { $ne: req.params.id } });
      if (existingSku) {
        throw ApiError.conflict(`A product with SKU "${normSku}" already exists. Please use a unique SKU.`);
      }
    }

    Object.assign(before, payload);
    await before.save();
    await logAudit({ user: req.user?.name, action: 'Update', module: moduleName, reference: req.params.id, before: beforeObj, after: before.toObject() });
    return ApiResponse.success(res, { message: `${entityName} updated successfully`, data: before });
  });

  const setStatus = asyncHandler(async (req, res) => {
    const record = await Model.findOne({ id: req.params.id });
    if (!record) throw ApiError.notFound(`${entityName} not found`);
    const before = record.status;
    record.status = req.body.status;
    await record.save();
    await logAudit({ user: req.user?.name, action: 'Update', module: moduleName, reference: req.params.id, before: { status: before }, after: { status: record.status } });
    return ApiResponse.success(res, { message: `${entityName} status updated`, data: record });
  });

  const deactivate = asyncHandler(async (req, res) => {
    const record = await Model.findOne({ id: req.params.id });
    if (!record) throw ApiError.notFound(`${entityName} not found`);
    record.status = 'Inactive';
    await record.save();
    await logAudit({ user: req.user?.name, action: 'Deactivate', module: moduleName, reference: req.params.id, after: { status: 'Inactive' } });
    return ApiResponse.success(res, { message: `${entityName} deactivated successfully`, data: record });
  });

  const reactivate = asyncHandler(async (req, res) => {
    const record = await Model.findOne({ id: req.params.id });
    if (!record) throw ApiError.notFound(`${entityName} not found`);
    record.status = 'Active';
    await record.save();
    await logAudit({ user: req.user?.name, action: 'Reactivate', module: moduleName, reference: req.params.id, after: { status: 'Active' } });
    return ApiResponse.success(res, { message: `${entityName} reactivated successfully`, data: record });
  });

  const remove = asyncHandler(async (req, res) => {
    const record = await Model.findOne({ id: req.params.id });
    if (!record) throw ApiError.notFound(`${entityName} not found`);

    if (typeof dependencyCheckFn === 'function') {
      const depCheck = await dependencyCheckFn(req.params.id);
      if (depCheck.isReferenced) {
        throw ApiError.conflict(depCheck.message);
      }
    }

    const beforeObj = record.toObject();
    await Model.deleteOne({ id: req.params.id });
    await logAudit({ user: req.user?.name, action: 'Delete', module: moduleName, reference: req.params.id, before: beforeObj });
    return ApiResponse.success(res, { message: `${entityName} deleted permanently`, data: { id: req.params.id } });
  });

  return { list, getById, create, update, setStatus, deactivate, reactivate, remove };
}

module.exports = { createCrudController };
