module.exports = {
	root: true,
	env: {
		node: true,
		commonjs: true
	},
	plugins: ["prettier"],
	extends: ["eslint:recommended", "prettier"],
	parserOptions: {
		ecmaVersion: 2020
	},
	rules: {
		"no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
		"no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
		"prettier/prettier": "warn"
	},
	overrides: [
		{
			files: ["./*.js"],
			parserOptions: {
				parser: "@babel/eslint-parser"
			}
		},
		{
			files: [
				"./*.ts",
				"./@types/*.ts",
				"./types/**/*.ts",
				"./utils/**/*.ts",
				"./deploy/**/*.ts",
				"./scripts/**/*.ts",
				"./test/**/*.ts"
			],
			parserOptions: {
				parser: "@typescript-eslint/parser",
				project: ["./tsconfig.json"]
			},
			plugins: ["@typescript-eslint", "import"],
			extends: [
				"plugin:@typescript-eslint/eslint-recommended",
				"plugin:@typescript-eslint/recommended",
				"plugin:@typescript-eslint/recommended-requiring-type-checking",
				"plugin:import/errors",
				"plugin:import/warnings",
				"plugin:import/typescript"
			],
			settings: {
				"import/parsers": {
					"@typescript-eslint/parser": [".ts", ".tsx"]
				},
				"import/resolver": {
					typescript: {
						alwaysTryTypes: true
					}
				}
			},
			rules: {
				"no-unused-vars": "off",
				"import/default": "off",
				"import/named": "off",
				"@typescript-eslint/camelcase": "off",
				"@typescript-eslint/interface-name-prefix": "off",
				"@typescript-eslint/no-misused-promises": [
					"error",
					{
						checksVoidReturn: false
					}
				],
				"@typescript-eslint/explicit-function-return-type": [
					"warn",
					{
						allowExpressions: true
					}
				],
				"@typescript-eslint/no-empty-interface": [
					"error",
					{
						allowSingleExtends: true
					}
				],
				"@typescript-eslint/naming-convention": [
					"error",
					{
						selector: "typeLike",
						format: ["PascalCase"]
					},
					{
						selector: "memberLike",
						format: ["PascalCase", "camelCase", "snake_case"]
					},
					{
						selector: "interface",
						prefix: ["I"],
						format: ["PascalCase"]
					},
					{
						selector: "memberLike",
						modifiers: ["private"],
						prefix: ["_"],
						format: ["strictCamelCase"]
					},
					{
						selector: "enumMember",
						format: ["UPPER_CASE", "PascalCase"]
					}
				]
			}
		}
	]
};
