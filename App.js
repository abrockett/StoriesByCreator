Ext.define('Rally.apps.storiesbycreator.App', {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',
    scopeType: 'release',
    comboboxConfig: {
        fieldLabel: 'Release:',
        labelWidth: 70,
        width: 300
    },

    addContent: function() {
        this.add({
            xtype: 'container',
            itemId: 'grid'
        });
        this._loadStories();
    },

    onScopeChange: function() {
        this._loadStories();
    },

    _loadStories: function() {
        Ext.create('Rally.data.WsapiDataStore', {
            model: 'User Story',
            autoLoad: true,
            fetch: ['FormattedID', 'Name', 'ScheduleState', 'CreationDate', 'Owner', 'RevisionHistory'],
            filters: [this.getContext().getTimeboxScope().getQueryFilter()],
            sorters: [{
                property: 'FormattedID',
                direction: 'ASC'
            }],
            listeners: {
                load: this._onStoryDataLoaded,
                scope: this
            }
        });
    },

    _onStoryDataLoaded: function(store, data) {
        this._customRecords = Ext.Array.map(data, function(story) {
            var owner = '';
            if (story.get('Owner') !== null) {
                owner = story.get('Owner')._refObjectName;
            }
            return {
                _ref: story.get('_ref'),
                FormattedID: story.get('FormattedID'),
                Name: story.get('Name'),
                ScheduleState: story.get('ScheduleState'),
                CreationDate: Rally.util.DateTime.formatWithDefault(story.get('CreationDate'), this.getContext()),
                CreatedBy: '',
                Owner: owner,
                RevisionHistory: story.get('RevisionHistory'),
                AcceptedBy: ''
            };
        }, this);

        this._getRevisionHistory();
    },

    _getRevisionHistory: function() {
        this._numberTimesLoaded = 0;

        if (this._customRecords.length > 0) {
            Rally.data.ModelFactory.getModel({
                type: 'RevisionHistory',
                scope: this,
                success: this._onModelLoaded
            });
        } else {
            this._buildGrid();
        }
    },

   
    _onModelLoaded: function(model) {
        Ext.Array.each(this._customRecords, function(story, index) {
            model.load(Rally.util.Ref.getOidFromRef(story.RevisionHistory), {
                scope: this,
                success: function(record) {
                    this._onRevisionHistoryLoaded(story, record);
                }
            });
        }, this);
    },


    _onRevisionHistoryLoaded: function(story, record) {
        record.getCollection('Revisions').load({
            fetch: ['User', 'Description'],
            scope: this,
            callback: function(revisions) {
                this._onRevisionsLoaded(revisions, story);
            }
        }); 
    },


    _onRevisionsLoaded: function(revisions, story) {
        Ext.Array.each(revisions, function(revision, revisionIndex) {
            if (revision.get('Description').search("ACCEPTED DATE added") !== -1 &&
                story.ScheduleState === 'Accepted') {
                story.AcceptedBy = revision.get('User')._refObjectName;
            }
            if (revisionIndex === (revisions.length-1)) {
                story.CreatedBy = revision.get('User')._refObjectName;
            }
        }, this);

        this._numberTimesLoaded++;

        if (this._numberTimesLoaded === this._customRecords.length) {
            this._buildGrid();
        }

    },

    _buildGrid: function() {
        var customStore = Ext.create('Rally.data.custom.Store', {
            data: this._customRecords,
            pageSize: this._customRecords.length
        });

        if (!this.grid) {
            this.grid = this.down('#grid').add({
                xtype: 'rallygrid',
                store: customStore,
                columnCfgs: [
                    {text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn', 
                        tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')},
                    {text: 'Story Name', dataIndex: 'Name', flex: 4},
                    {text: 'Schedule State', dataIndex: 'ScheduleState', flex: 1},
                    {text: 'Date Created', dataIndex: 'CreationDate', flex: 1},
                    {text: 'Created By', dataIndex: 'CreatedBy', flex: 1},
                    {text: 'Owner', dataIndex: 'Owner', flex: 1},
                    {text: 'Accepted By', dataIndex: 'AcceptedBy', flex: 1}
                ]
            });
        } else {
            this.grid.reconfigure(customStore);
        }
    },

    getOptions: function() {
        return [
            {
                text: 'Print',
                handler: this._onButtonPressed,
                scope: this
            }
        ];
    },

    _onButtonPressed: function() {
        var title = this.getContext().getTimeboxScope().getRecord().get('Name'),
            options = "toolbar=1,menubar=1,scrollbars=yes,scrolling=yes,resizable=yes,width=1000,height=500";

        // code to get the style that we added in the app.css file
        var css = document.getElementsByTagName('style')[0].innerHTML;

        var printWindow;

        if (Ext.isIE) {
            printWindow = window.open();
        } else {
            printWindow = window.open('', title, options);
        }

        var doc = printWindow.document;

        var grid = this.down('#grid');

        doc.write('<html><head>' + '<style>' + css + '</style><title>' + title + '</title>');
        doc.write('</head><body class="landscape">');
        doc.write('<p style="font-family:Arial,Helvetica,sans-serif;margin:5px">Release: ' + title + '</p><br />');
        doc.write(grid.getEl().dom.innerHTML);
        doc.write('</body>');
        doc.write('</html>');
        doc.close();

        this._injectCSS(printWindow);

        if (Ext.isSafari) {
            var timeout = setTimeout(function() {
                printWindow.print();
            }, 500);
        } else {
            printWindow.print();
        }

    },

    _injectContent: function(html, elementType, attributes, container, printWindow){
        elementType = elementType || 'div';
        container = container || printWindow.document.getElementsByTagName('body')[0];

        var element = printWindow.document.createElement(elementType);

        Ext.Object.each(attributes, function(key, value){
            if (key === 'class') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        });

        if(html){
            element.innerHTML = html;
        }

        return container.appendChild(element);
    },

    _injectCSS: function(printWindow){
        //find all the stylesheets on the current page and inject them into the new page
        Ext.each(Ext.query('link'), function(stylesheet){
                this._injectContent('', 'link', {
                rel: 'stylesheet',
                href: stylesheet.href,
                type: 'text/css'
            }, printWindow.document.getElementsByTagName('head')[0], printWindow);
        }, this);
    }
});
