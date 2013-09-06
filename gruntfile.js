var _ = require('lodash'),
	packages = {
		'index': 'views/index.html',
		'edit': 'views/edit.html'
	},
	srcDir = 'public_src',
	destDir = 'public',
	distDir = 'dist';

module.exports = function (grunt) {
	var buildVersion = encodeURIComponent(grunt.template.date(new Date().getTime(), 'yyyymmddHHMMsso'));

	grunt.initConfig({
		/*css procompiling*/
		less: {
			bootstrap: {
				files: [{
					src: getSrcFiles('/components/bootstrap/less/bootstrap.less'),
					dest: getSrcFile('/css/bootstrap.css')
				}]
			}
		},

		/*generate startup.js*/
		concat: {
			startup: {
				options: {
					header: '// this file is auto generated by build-process, please do not modify it by yourself.',
					footer: '\nrequire(["main"]);\n'
				},
				files: [{
					src: getSrcFiles(['components/requirejs/require.js', 'scripts/config.js']),
					dest: getSrcFile('scripts/startup.js')
				}]
			},
			startupbuild: {
				options: {
					header: '// this file is auto generated by build-process, please do not modify it by yourself.',
					footer: '\nrequire(["main"]);\n',
					process: function (src, filePath) {
						return src.replace('urlArgs: "bust=" +  (new Date()).getTime()',
							'urlArgs: "v=' + buildVersion + '"');
					}
				},
				files: [{
					src: getSrcFiles(['components/requirejs/require.js', 'scripts/config.js']),
					dest: getSrcFile('scripts/.startup.build.js')
				}]
			}
		},

		/*generate templates for debug mode*/
		templates_debug: {
			options: {
				base: getSrcFile('scripts')
			},
			partials: {
				options: {
					partial: true
				},
				files: getTemplatePathsConfig('partials', true)
			},
			templates: {
				files: getTemplatePathsConfig('templates', true)
			}
		},

		/*precompile templates when distribute*/
		handlebars: {
			partials: {
				options: {
					amd: true,
					partialRegex: /.*/,
					partialsPathRegex: /\/partials\//,
					processPartialName: processHandlebarsTemplateName(true)
				},
				files: getTemplatePathsConfig('partials')
			},
			templates: {
				options: {
					amd: true,
					processName: processHandlebarsTemplateName()
				},
				files: getTemplatePathsConfig('templates')
			}
		},

		/*copy resources to dist dir*/
		copy: {
			jade: {
				options: {
					processContent: function (content, srcPath) {
						content = content.replace(/src=(.*)\.js[^'">\s]*/mg, 'src=$1.js?v=' + buildVersion)
							.replace(/href=(.*)\.css[^'">\s]*/mg, 'href=$1.css?v=' + buildVersion);

						return content;
					}
				},
				files: getHtmlEntriesConfig(packages)
			},
			imgs: {
				files: [{
					expand: true,
					src: getSrcFiles(['css/**/img/*.*', 'img/*.*']),
					dest: destDir,
					filter: 'isFile'
				}]
			},
			ace: {
				files: [{
					expand: true,
					cwd: 'public_src',
					src: 'ace-builds-1.1.01/**',
					dest: destDir
				}]
			},
			dist: {
				options: {
					mode: true
				},
				files: [{
					expand: true,
					src: ['deploy.sh', 'package.json', 'views/**', 'config/**',
						'node_modules/**', '!node_modules/grunt*/**', 'public/**', 'deploy/**', '!deploy/node-32/bin/npm',
						'!deploy/node-64/bin/npm'],
					dest: distDir
				}]
			}
		},

		symlink: {
			npm: {
				files: [{
					src: ['dist/deploy/node-32/lib/node_modules/npm/bin/npm-cli.js'],
					dest: 'dist/deploy/node-32/bin/npm'
				}, {
					src: ['dist/deploy/node-64/lib/node_modules/npm/bin/npm-cli.js'],
					dest: 'dist/deploy/node-64/bin/npm'
				}]
			}
		},

		uglify: {
			options: {
				mangle: true
			},
			nodejs: {
				files: [{
					src: 'app.js',
					dest: distDir + '/app.js'
				}, {
					src: 'lib/config_util.js',
					dest: distDir + '/lib/config_util.js'
				}, {
					src: 'lib/handlebars_helper.js',
					dest: distDir + '/lib/handlebars_helper.js'
				}, {
					src: 'lib/io.js',
					dest: distDir + '/lib/io.js'
				}, {
					src: 'lib/utils.js',
					dest: distDir + '/lib/utils.js'
				}]
			}
		},

		/*resolve dependecies, js&css optimization*/
		requirejs: getRequirejsConfig(destDir),

		/* development asistant*/
		watch: getWatchConfig(),

		jshint: {
			options: {
				force: true,
				'-W030': true
			},
			all: getSrcFiles(['scripts/**/*.js', '!scripts/**/.*_compiled.js',
				'!scripts/**/.auto_*.js', '!scripts/startup.js', '!scripts/text.js', '!**/.*', '!scripts/common/socket.io.js', '!scripts/common/diff_match_patch.js'
			])
		},

		clean: {
			options: {
				force: true
			},
			temporary: getSrcFiles(['scripts/**/.auto_*', 'scripts/**/.*_compiled*', 'scripts/**/.*.js']),
			dest: [destDir],
			distDir: [distDir],
			tarball: ['dist*.tar.gz']
		},

		tarball: {
			dist: {}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-requirejs');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-livereload');
	grunt.loadNpmTasks('grunt-contrib-handlebars');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-symlink');

	grunt.loadTasks('grunt_tasks');

	grunt.registerTask('init', ['less', 'templates_debug', 'concat:startup', 'watch']);
	grunt.registerTask('dist', ['clean', 'less', 'jshint', 'handlebars', 'concat', 'requirejs', 'copy', 'symlink', 'uglify', 'tarball', 'clean:temporary', 'clean:distDir']);
	grunt.registerTask('default', ['dist', 'init']);

	grunt.event.on('watch', function (action, filePath) {
		grunt.config(['jshint', 'all'], filePath);
	});
};

function getRequirejsConfig(destDir) {
	var config = {
		startupjs: getRequirejsConfigHelper('js', '.startup.build', destDir + '/scripts/startup.js', true),
		startupcss: getRequirejsConfigHelper('css', getSrcFile('css/startup.css'), destDir + '/css/startup.css')
	};

	_.each(packages, function (entryPath, packagePath) {
		var packageName = packagePath.split('/').join('');
		var cssFileName = packagePath.split('/').join('_');

		config[packageName + 'js'] = getRequirejsConfigHelper('js', packagePath + '/main', destDir + '/scripts/' + packagePath + '/main.js');
		config[packageName + 'css'] = getRequirejsConfigHelper('css', getSrcFile('css/' + cssFileName + '.css'), destDir + '/css/' + cssFileName + '.css');
	});

	return config;
}

function getRequirejsConfigHelper(type, inPath, outPath, isStartup) {
	var packagePaths = {};

	_.each(packages, function (entryPath, packagePath) {
		packagePaths[packagePath + '/templates_compiled'] = packagePath + '/templates/.templates_compiled';
	});

	if (type == 'js') {
		return {
			options: {
				baseUrl: getSrcFile('scripts'),
				mainConfigFile: getSrcFile('scripts/config.js'),
				name: inPath,
				optimize: 'uglify2',
				out: outPath,
				preserveLicenseComments: false,
				generateSourceMaps: true,
				paths: _.extend({
					'handlebars': '../components/handlebars/handlebars.runtime',
					'common/partials_compiled': 'common/templates/.partials_compiled',
					'common/templates_compiled': 'common/templates/.templates_compiled'
				}, packagePaths),
				exclude: isStartup ? [] : ['startup']
			}
		};
	} else if (type == 'css') {
		return {
			options: {
				optimizeCss: 'standard',
				cssIn: inPath,
				out: outPath
			}
		};
	} else {
		throw new Error('unrecognized requirejs optimization type');
	}
}

function getTemplatePathsConfig(type, isDebug) {
	var fileConfig = {

	};

	if (type == 'partials') {
		if (isDebug) {
			fileConfig[getSrcFile('scripts/common/templates/.auto_partials.js')] = getSrcFiles(['scripts/common/templates/partials/**/*.hb']);
		} else {
			fileConfig[getSrcFile('scripts/common/templates/.partials_compiled.js')] = getSrcFiles(['scripts/common/templates/partials/**/*.hb']);
		}
	}

	if (type == 'templates') {
		if (isDebug) {
			fileConfig[getSrcFile('scripts/common/templates/.auto_templates.js')] = getSrcFiles(['scripts/common/templates/**/*.hb',
				'!scripts/common/templates/partials/**/*.hb'
			]);
		} else {
			fileConfig[getSrcFile('scripts/common/templates/.templates_compiled.js')] = getSrcFiles(['scripts/common/templates/**/*.hb',
				'!scripts/common/templates/partials/**/*.hb'
			]);
		}
	}

	templatePaths = _.clone(packages);

	_.each(templatePaths, function (entryPath, templatePath) {
		templatePath = getSrcFile('scripts/' + templatePath);

		if (type == 'partials') {
			if (isDebug) {
				fileConfig[templatePath + '/templates/.auto_partials.js'] = [templatePath + '/templates/partials/**/*.hb'];
			} else {
				fileConfig[templatePath + '/templates/.partials_compiled.js'] = [templatePath + '/templates/partials/**/*.hb'];
			}
		}

		if (type == 'templates') {
			if (isDebug) {
				fileConfig[templatePath + '/templates/.auto_templates.js'] = [templatePath + '/templates/**/*.hb',
					'!' + templatePath + '/templates/partials/**/*.hb'
				];
			} else {
				fileConfig[templatePath + '/templates/.templates_compiled.js'] = [templatePath + '/templates/**/*.hb',
					'!' + templatePath + '/templates/partials/**/*.hb'
				];
			}
		}
	});

	return fileConfig;
}

function processHandlebarsTemplateName(isPartial) {
	return function (filePath) {
		var fileName = filePath.replace(new RegExp('^' + getSrcFile('scripts/')), '').replace(isPartial ? /templates\/partials\// : /templates\//, '').replace(/\..*$/, '');
		return fileName.replace(/\/main$/, '');
	};
}

function getWatchConfig() {
	return {
		scripts: {
			options: {
				livereload: true,
				nospawn: true
			},
			files: getSrcFiles(['scripts/config.js']),
			tasks: ['concat:startup', 'jshint']
		},
		templates: {
			options: {
				livereload: true
			},
			files: getSrcFiles(['scripts/**/*.hb']),
			tasks: ['templates_debug']
		},
		livereload: {
			files: getSrcFiles(['css/**/*', 'favicon.ico', 'img/**/*', 'components/**/*.js', '!components/requirejs/require.js', '!css/bootstrap.css']),
			options: {
				livereload: true
			}
		},
		jshintreload: {
			options: {
				livereload: true,
				nospawn: true
			},
			files: getSrcFiles(['scripts/**/*.js', '!scripts/**/.*_compiled.js', '!scripts/startup.js',
				'!scripts/**/.auto_*.js', '!scripts/config.js', '!scripts/common/socket.io.js', '!scripts/common/diff_match_patch.js'
			]),
			tasks: ['jshint']
		},
		less: {
			options: {
				livereload: true
			},
			files: getSrcFiles(['components/bootstrap/less/**/*.less']),
			tasks: ['less']
		}
	};
}

function getHtmlEntriesConfig(packages) {
	var config = [];

	_.each(packages, function (entryPaths) {
		entryPaths = _.isArray(entryPaths) ? entryPaths : [entryPaths];

		_.each(entryPaths, function (entryPath) {
			config.push({
				expand: true,
				src: [entryPath],
				dest: '.',
				filter: 'isFile'
			});
		});
	});

	config = _.unique(config, function (item) {
		return item.src[0];
	});

	return config;
}

function getSrcFile(path) {
	return getFiles(srcDir, path)[0];
}

function getSrcFiles(paths) {
	return getFiles(srcDir, paths);
}

function getDestFile(path) {
	return getFiles(destDir, path)[0];
}

function getFiles(root, paths) {
	var results = [];

	if (!_.isArray(paths)) {
		paths = [paths];
	}

	root = root.replace(/\/$/g, '');

	_.each(paths, function (path) {
		var isNo = false;
		if (path[0] == '!') {
			path = path.slice(1);
			isNo = true;
		}

		results.push((isNo ? '!' : '') + root + path.replace(/^([^\/])(.*)/, '/$1$2'));
	});

	return results;
}
