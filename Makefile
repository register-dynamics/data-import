
update-deps:
	@echo "***************************"
	@echo "** Updating importer lib **"
	@echo "***************************"
	@cd lib/importer && npm install
	@echo "***********************************"
	@echo "** Default development prototype **"
	@echo "***********************************"
	@cd prototypes/basic && npm install


.PHONY: prototype
ifndef NAME
prototype:
	$(error Need a value for NAME, e.g., make prototype NAME=value)
else
prototype:
	@cd lib/importer && npm install
	@mkdir -p prototypes/${NAME}
	@cd prototypes/${NAME} && npx govuk-prototype-kit@latest create && npm install ../../lib/importer
	@echo "\
	You should now change the service name in prototypes/${NAME}/app/config.json\n\
	and edit the homepage at prototypes/${NAME}/app/views/index.html\n\
\n\
	You can run the prototype with:\n\
\n\
	    cd prototypes/${NAME}\n\
	    npm run dev\n\
	"
endif

