class ApiResponse {
  static success(res, { message = 'Success', data = null, pagination = null, statusCode = 200 } = {}) {
    const body = { success: true, message, data };
    if (pagination) body.pagination = pagination;
    return res.status(statusCode).json(body);
  }

  static created(res, { message = 'Created successfully', data = null } = {}) {
    return ApiResponse.success(res, { message, data, statusCode: 201 });
  }
}

module.exports = ApiResponse;
