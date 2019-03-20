"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsonschema_1 = require("jsonschema");
var values = require("lodash.values");
var schemas_1 = require("./schemas");
/**
 * A validator for [JSON-schemas](http://json-schema.org/)
 */
var SchemaValidator = /** @class */ (function () {
    /**
     * Instantiates a SchemaValidator instance
     */
    function SchemaValidator() {
        this._validator = new jsonschema_1.Validator();
        for (var _i = 0, _a = values(schemas_1.schemas); _i < _a.length; _i++) {
            var schema = _a[_i];
            SchemaValidator._assertSchemaDefined(schema);
            this._validator.addSchema(schema, schema.id);
        }
    }
    SchemaValidator._assertSchemaDefined = function (schema) {
        if (schema === undefined) {
            throw new Error("Cannot add undefined schema");
        }
    };
    /**
     * Add a schema to the validator. All schemas and sub-schemas must be added to
     * the validator before the `validate` and `isValid` methods can be called with
     * instances of that schema.
     * @param schema The schema to add
     */
    SchemaValidator.prototype.addSchema = function (schema) {
        SchemaValidator._assertSchemaDefined(schema);
        this._validator.addSchema(schema, schema.id);
    };
    // In order to validate a complex JS object using jsonschema, we must replace any complex
    // sub-types (e.g BigNumber) with a simpler string representation. Since BigNumber and other
    // complex types implement the `toString` method, we can stringify the object and
    // then parse it. The resultant object can then be checked using jsonschema.
    /**
     * Validate the JS object conforms to a specific JSON schema
     * @param instance JS object in question
     * @param schema Schema to check against
     * @returns The results of the validation
     */
    SchemaValidator.prototype.validate = function (instance, schema) {
        SchemaValidator._assertSchemaDefined(schema);
        var jsonSchemaCompatibleObject = JSON.parse(JSON.stringify(instance));
        return this._validator.validate(jsonSchemaCompatibleObject, schema);
    };
    /**
     * Check whether an instance properly adheres to a JSON schema
     * @param instance JS object in question
     * @param schema Schema to check against
     * @returns Whether or not the instance adheres to the schema
     */
    SchemaValidator.prototype.isValid = function (instance, schema) {
        var isValid = this.validate(instance, schema).errors.length === 0;
        return isValid;
    };
    return SchemaValidator;
}());
exports.SchemaValidator = SchemaValidator;
//# sourceMappingURL=validator.js.map