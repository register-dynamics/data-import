

.PHONY: prototype
prototype:
ifndef NAME
    $(error Need a value for NAME, e.g., make prototype NAME=value)
endif
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
