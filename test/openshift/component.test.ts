/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { TestItem } from './testOSItem';
import { OdoImpl } from '../../src/odo';
import { Component } from '../../src/openshift/component';
import { Progress } from '../../src/util/progress';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Component', () => {
    let sandbox: sinon.SinonSandbox;
    let termStub: sinon.SinonStub, execStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const appItem = new TestItem(projectItem, 'application');
    const componentItem = new TestItem(appItem, 'component');
    const serviceItem = new TestItem(appItem, 'service');
    const errorMessage = 'FATAL ERROR';

    setup(() => {
        sandbox = sinon.createSandbox();
        termStub = sandbox.stub(OdoImpl.prototype, 'executeInTerminal');
        execStub = sandbox.stub(OdoImpl.prototype, 'execute');
        sandbox.stub(OdoImpl.prototype, 'getServices');
        sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
        sandbox.stub(OdoImpl.prototype, 'getApplications').resolves([]);
        sandbox.stub(OdoImpl.prototype, 'getComponents').resolves([]);
        sandbox.stub(Component, 'wait').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        const componentType = 'nodejs';
        const version = 'latest';
        const folder = { uri: { fsPath: 'folder' } };
        let quickPickStub: sinon.SinonStub,
            inputStub: sinon.SinonStub,
            progressStub: sinon.SinonStub,
            progressCmdStub: sinon.SinonStub;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves('Workspace Directory');
            quickPickStub.onSecondCall().resolves(componentType);
            quickPickStub.onThirdCall().resolves(version);
            inputStub = sandbox.stub(vscode.window, 'showInputBox');
            progressStub = sandbox.stub(Progress, 'execWithProgress').resolves();
            progressCmdStub = sandbox.stub(Progress, 'execCmdWithProgress').resolves();
        });

        test('returns null when cancelled', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.create(appItem);

            expect(result).null;
        });

        test('errors when a subcommand fails', async () => {
            sandbox.stub(vscode.window, 'showWorkspaceFolderPick').rejects(errorMessage);

            try {
                await Component.create(appItem);
                expect.fail();
            } catch (error) {
                expect(error).equals(`Failed to create component with error '${errorMessage}'`);
            }
        });

        suite('from local workspace', () => {
            let folderStub: sinon.SinonStub;

            setup(() => {
                inputStub.resolves(componentItem.getName());
                folderStub = sandbox.stub(vscode.window, 'showWorkspaceFolderPick').resolves(folder);
            });

            test('happy path works', async () => {
                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created`);
                expect(progressCmdStub).calledOnceWith(
                    `Creating new component '${componentItem.getName()}'`,
                    `odo create ${componentType}:${version} ${componentItem.getName()} --local ${folder.uri.fsPath} --app ${appItem.getName()} --project ${projectItem.getName()}`);
                expect(termStub).calledOnceWith(`odo push ${componentItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()} --local ${folder.uri.fsPath}`);
            });

            test('returns null when no folder selected', async () => {
                folderStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type version selected', async () => {
                quickPickStub.onThirdCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });
        });

        suite('from git repository', () => {
            const uri = 'git uri';
            let infoStub: sinon.SinonStub;

            setup(() => {
                quickPickStub.onFirstCall().resolves({ label: 'Git Repository' });
                inputStub.onFirstCall().resolves(uri);
                inputStub.onSecondCall().resolves(componentItem.getName());
                infoStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
            });

            test('happy path works', async () => {
                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created`);
                expect(termStub).calledOnceWith(`odo create ${componentType}:${version} ${componentItem.getName()} --git ${uri} --app ${appItem.getName()} --project ${projectItem.getName()}`);
            });

            test('returns null when no git repo selected', async () => {
                inputStub.onFirstCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type version selected', async () => {
                quickPickStub.onThirdCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('clones the git repo if selected', async () => {
                infoStub.resolves('Yes');
                const commandStub = sandbox.stub(vscode.commands, 'executeCommand');
                await Component.create(appItem);

                expect(commandStub).calledOnceWith('git.clone', uri);
            });
        });

        suite('from binary file', () => {
            let fileStub: sinon.SinonStub;
            const files = [{ fsPath: 'test/sample.war' }];

            setup(() => {
                quickPickStub.onFirstCall().resolves({ label: 'Binary File' });
                fileStub = sandbox.stub(vscode.window, 'showOpenDialog').resolves(files);
                inputStub.resolves(componentItem.getName());
            });

            test('happy path works', async () => {

                const result = await Component.create(appItem);

                expect(result).equals(`Component '${componentItem.getName()}' successfully created`);
                expect(progressCmdStub).calledOnceWith(
                    `Creating new component '${componentItem.getName()}'`,
                    `odo create ${componentType}:${version} ${componentItem.getName()} --binary ${files[0].fsPath} --app ${appItem.getName()} --project ${projectItem.getName()}`);
            });

            test('returns null when no binary file selected', async () => {
                fileStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component name selected', async () => {
                inputStub.resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type selected', async () => {
                quickPickStub.onSecondCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });

            test('returns null when no component type version selected', async () => {
                quickPickStub.onThirdCall().resolves();
                const result = await Component.create(appItem);

                expect(result).null;
            });
        });
    });

    suite('del', () => {
        let quickPickStub: sinon.SinonStub, warnStub: sinon.SinonStub;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            quickPickStub.onFirstCall().resolves(projectItem);
            quickPickStub.onSecondCall().resolves(appItem);
            quickPickStub.onThirdCall().resolves(componentItem);
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            execStub.resolves({error: undefined, stdout: '', stderr: ''});
        });

        test('works from context menu', async () => {
            const result = await Component.del(componentItem);

            expect(result).equals(`Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(`odo delete ${componentItem.getName()} -f --app ${appItem.getName()} --project ${projectItem.getName()}`);
        });

        test('works with no context', async () => {
            const result = await Component.del(null);

            expect(result).equals(`Component '${componentItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(`odo delete ${componentItem.getName()} -f --app ${appItem.getName()} --project ${projectItem.getName()}`);
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);

            try {
                await Component.del(componentItem);
            } catch (err) {
                expect(err).equals(`Failed to delete component with error '${errorMessage}'`);
            }
        });

        test('returns null when no project is selected', async () => {
            quickPickStub.onFirstCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });

        test('returns null when no application is selected', async () => {
            quickPickStub.onSecondCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });

        test('returns null when no component is selected', async () => {
            quickPickStub.onThirdCall().resolves();
            const result = await Component.del(null);

            expect(result).null;
        });
    });

    suite('linkService', () => {
        let quickPickStub: sinon.SinonStub;

        setup(() => {
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        });

        test('works from context menu', async () => {
            quickPickStub.resolves(serviceItem);
            const result = await Component.linkService(componentItem);

            expect(result).equals(`service '${serviceItem.getName()}' successfully linked with component '${componentItem.getName()}'`);
            expect(execStub).calledOnceWith(`odo project set ${projectItem.getName()} && odo application set ${appItem.getName()} && odo component set ${componentItem.getName()} && odo link ${serviceItem.getName()} --wait`);
        });

        test('returns null when no service type selected to link', async () => {
            quickPickStub.resolves();
            const result = await Component.linkService(componentItem);

            expect(result).null;
        });

        test('errors when a subcommand fails', async () => {
            quickPickStub.resolves(componentItem);
            execStub.rejects(errorMessage);
            let savedErr;

            try {
                await Component.linkService(componentItem);
            } catch (err) {
                savedErr = err;
            }
            expect(savedErr).equals(`Failed to link service with error '${errorMessage}'`);
        });
    });

    test('describe calls the correct odo command in terminal', () => {
        Component.describe(componentItem);

        expect(termStub).calledOnceWith(`odo describe ${componentItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()}`);
    });

    test('log calls the correct odo command in terminal', () => {
        Component.log(componentItem);

        expect(termStub).calledOnceWith(`odo log ${componentItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()}`);
    });

    test('followLog calls the correct odo command in terminal', () => {
        Component.followLog(componentItem);

        expect(termStub).calledOnceWith(`odo log ${componentItem.getName()} -f --app ${appItem.getName()} --project ${projectItem.getName()}`);
    });

    test('push calls the correct odo command with progress', async () => {
        const status = await Component.push(componentItem);

        expect(termStub).calledOnceWith(`odo push ${componentItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()}`);
    });

    test('watch calls the correct odo command in terminal', () => {
        Component.watch(componentItem);

        expect(termStub).calledOnceWith(`odo watch ${componentItem.getName()} --app ${appItem.getName()} --project ${projectItem.getName()}`);
    });
});