/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { OdoImpl } from '../../src/odo';
import { TestItem } from './testOSItem';
import { Project } from '../../src/openshift/project';

const expect = chai.expect;
chai.use(sinonChai);

suite('Openshift/Project', () => {
    let sandbox: sinon.SinonSandbox;
    let execStub: sinon.SinonStub;
    const projectItem = new TestItem(null, 'project');
    const errorMessage = 'ERROR MESSAGE';

    setup(() => {
        sandbox = sinon.createSandbox();
        execStub = sandbox.stub(OdoImpl.prototype, 'execute').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('create', () => {
        let inputStub: sinon.SinonStub;

        setup(() => {
            inputStub = sandbox.stub(vscode.window, 'showInputBox').resolves(projectItem.getName());
        });

        test('works with valid inputs', async () => {
            const result = await Project.create();

            expect(result).equals(`Project '${projectItem.getName()}' successfully created`);
            expect(execStub).calledOnceWith(`odo project create ${projectItem.getName()}`);
        });

        test('returns null with no project name selected', async () => {
            inputStub.resolves();
            const result = await Project.create();

            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Project.create();
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to create project with error '${errorMessage}'`);
            }
        });
    });

    suite('del', () => {
        let warnStub: sinon.SinonStub, quickPickStub: sinon.SinonStub;

        setup(() => {
            warnStub = sandbox.stub(vscode.window, 'showWarningMessage').resolves('Yes');
            quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves(projectItem);
            sandbox.stub(OdoImpl.prototype, 'getProjects').resolves([]);
        });

        test('works with context', async () => {
            const result = await Project.del(projectItem);

            expect(result).equals(`Project '${projectItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(`odo project delete ${projectItem.getName()} -f`);
        });

        test('works without context', async () => {
            const result = await Project.del(null);

            expect(result).equals(`Project '${projectItem.getName()}' successfully deleted`);
            expect(execStub).calledOnceWith(`odo project delete ${projectItem.getName()} -f`);
        });

        test('returns null with no project selected', async () => {
            quickPickStub.resolves();
            const result = await Project.del(null);

            expect(result).null;
        });

        test('returns null when cancelled', async () => {
            warnStub.resolves('Cancel');
            const result = await Project.del(null);

            expect(result).null;
        });

        test('wraps errors in additional info', async () => {
            execStub.rejects(errorMessage);
            try {
                await Project.del(projectItem);
                expect.fail();
            } catch (err) {
                expect(err).equals(`Failed to delete project with error '${errorMessage}'`);
            }
        });
    });
});