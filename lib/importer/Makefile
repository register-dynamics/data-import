frontend-test:
	@echo "\nTesting frontend"
	@echo "=================="
	@npx jest ./src/*.test.js -t $(TEST)

backend-test:
	@echo "\nTesting backend"
	@echo "=================="

	@npx jest ./src/dudk/  -t $(TEST)

test: backend-test frontend-test

